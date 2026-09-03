from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional
from ...config import settings


DEFAULT_DIRECTOR_PROMPT = """You are an expert AI Video Editor and Viral Shorts Director specializing in high-retention 9:16 vertical video content.
Your task is to analyze the provided video transcript with timecodes and extract the most compelling, self-contained clips for YouTube Shorts, TikTok, and Instagram Reels.

### TRANSCRIPT FORMAT:
`[HH:MM:SS.mmm --> HH:MM:SS.mmm] Spoken words on this line...`

### CORE DIRECTIVES & GUARDRAILS:
1. Duration & Timecode Awareness (STRICT REQUIREMENT: 20.0 to 50.0 SECONDS):
   - Every clip MUST span between 20.0 and 50.0 seconds (e.g., from 00:01:00.180 to 00:01:35.760).
   - Every clip MUST end on a complete, satisfying payoff (a strong revelation, punchline, key lesson, or resolution). Never cut off mid-thought.
   - Always output exact start_time and end_time.

2. 100% Verbatim Spoken Text:
   - The clip_text property MUST contain the EXACT, contiguous verbatim words spoken between start_time and end_time.
   - Do NOT paraphrase, do NOT add ellipses, do NOT edit words.

3. Virality & Ranking:
   - Order clips strictly in descending order of virality_score (clip 01 = highest virality).
   - Assign a realistic hook_rating (A+, A, B+).

4. Social Copy:
   - Provide a punchy working title (under 50 characters).
   - Generate a 1-2 sentence caption opening with a strong hook, concluding with the mandatory CTA and hashtags.

### OUTPUT FORMAT:
Respond with valid JSON:
{
  "clips": [
    {
      "clip_id": "01",
      "virality_score": 95,
      "hook_rating": "A+",
      "title": "Impactful Working Title",
      "caption": "Punchy hook caption... #Shorts #Viral\\n\\nLink in bio",
      "start_time": "00:01:00.180",
      "end_time": "00:01:35.760",
      "clip_text": "Exact contiguous verbatim spoken words across this time window without timecodes..."
    }
  ]
}
"""


FALLBACK_FLASH_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.5-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.1-lite",
    "gemini-2.0-flash-lite",
]


class GeminiClipDirector:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        configured_model = settings.GEMINI_DIRECTOR_MODEL or "gemini-3.7-flash"
        candidate_models = [configured_model] + FALLBACK_FLASH_MODELS
        seen = set()
        self.models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    def direct_clips(
        self,
        transcript_text: str,
        video_title: str,
        target_clip_count: int = 5,
        brand_profile: Optional[Dict[str, Any]] = None,
        custom_instructions: Optional[str] = None,
        pacing_mode: str = "snappy",
        time_range_start: Optional[float] = None,
        time_range_end: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        system_prompt = DEFAULT_DIRECTOR_PROMPT
        if brand_profile and brand_profile.get("director_system_prompt"):
            system_prompt = brand_profile["director_system_prompt"]

        context_parts = [
            f"Video Title: {video_title}",
            f"Target Clip Count: {target_clip_count}",
            f"Pacing Mode: {pacing_mode}",
        ]
        if brand_profile:
            for k in ["brand_name", "tone_of_voice", "target_audience", "mandatory_cta", "forbidden_words", "hashtags"]:
                if brand_profile.get(k):
                    context_parts.append(f"{k.replace('_', ' ').title()}: {brand_profile[k]}")

        if custom_instructions:
            context_parts.append(f"Special Instructions: {custom_instructions}")

        if time_range_start is not None or time_range_end is not None:
            s_str = f"{int(time_range_start//3600):02d}:{int((time_range_start%3600)//60):02d}:{int(time_range_start%60):02d}" if time_range_start is not None else "00:00:00"
            e_str = f"{int(time_range_end//3600):02d}:{int((time_range_end%3600)//60):02d}:{int(time_range_end%60):02d}" if time_range_end is not None else "End of video"
            context_parts.append(
                f"CRITICAL TIME WINDOW CONSTRAINT: You MUST only extract clips that fall strictly within the user's selected segment: {s_str} to {e_str}. Do not select any moments outside this window."
            )

        user_content = (
            f"Extract exactly {target_clip_count} top-performing viral clips from this transcript.\n\n"
            + "\n".join(context_parts)
            + f"\n\nTRANSCRIPT:\n{transcript_text}"
        )

        clips = []
        if self.api_key:
            from google import genai
            client = genai.Client(api_key=self.api_key)

            for model_name in self.models_to_try:
                try:
                    print(f"[GeminiClipDirector] Attempting clip extraction with {model_name}...")
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[system_prompt, user_content]
                    )
                    text = response.text.strip()
                    if text.startswith("```json"):
                        text = text[7:]
                    if text.endswith("```"):
                        text = text[:-3]
                    data = json.loads(text.strip())
                    clips = data.get("clips", [])
                    if clips:
                        print(f"[GeminiClipDirector] Successfully extracted clips using {model_name}.")
                        break
                except Exception as e:
                    print(f"[GeminiClipDirector] {model_name} failed ({e}). Falling back to next model in cascade...")

        if not clips:
            clips = self._fallback_extract(transcript_text, target_clip_count)

        normalized = []
        for idx, clip in enumerate(clips[:target_clip_count], start=1):
            raw_clip_text = str(clip.get("clip_text") or "").strip()
            clean_text = re.sub(r"\[\d{1,2}:?\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*-->\s*\d{1,2}:?\d{2}(?::\d{2})?(?:\.\d+)?)?\]", "", raw_clip_text).strip()
            normalized.append({
                "clip_id": f"{idx:02d}",
                "title": str(clip.get("title") or f"Clip {idx:02d}").strip(),
                "virality_score": int(clip.get("virality_score") or (98 - idx * 3)),
                "hook_rating": str(clip.get("hook_rating") or "A").strip(),
                "caption": str(clip.get("caption") or "").strip(),
                "start_time": str(clip.get("start_time") or "").strip(),
                "end_time": str(clip.get("end_time") or "").strip(),
                "clip_text": clean_text or "Key moment excerpt",
            })
        return normalized

    def _fallback_extract(self, transcript_text: str, target_count: int) -> List[Dict[str, Any]]:
        clean_text = re.sub(r"\[\d{1,2}:?\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*-->\s*\d{1,2}:?\d{2}(?::\d{2})?(?:\.\d+)?)?\]", "", transcript_text)
        sentences = [s.strip() for s in re.split(r"[.!?]+", clean_text) if len(s.strip().split()) >= 4]
        if not sentences:
            sentences = ["This is a key takeaway from today's lesson.", "Equip yourself daily and take positive action.", "Never give up on your journey."]
        
        step = max(1, len(sentences) // target_count)
        clips = []
        for i in range(min(target_count, len(sentences))):
            idx = i * step
            chunk = " ".join(sentences[idx : min(len(sentences), idx + 3)])
            clips.append({
                "clip_id": f"{i+1:02d}",
                "title": f"Key Highlight {i+1}",
                "virality_score": 92 - i * 2,
                "hook_rating": "A",
                "caption": f"{chunk[:60]}... #Shorts #Viral\n\nLink in bio",
                "clip_text": chunk,
            })
        return clips
