# Shoort Clips: 30-second Seedance test

A fast, realistic product explainer with one female presenter, clipping/scheduling proof-of-work, and a clear autopilot CTA. The generated interface is illustrative, not a recording of the live product.

## 1. Select the model and settings

- Model: Dreamina Seedance 2.5. The official API identifier is `dreamina-seedance-2-5-260628`; your UI may show a friendly name.
- Duration: 30 seconds.
- Aspect ratio: 16:9.
- Resolution: 720p for the initial test. Only select a higher resolution if your chosen interface offers it for this exact model.
- Audio: enabled.
- If available, choose multimodal/reference input, not a mode that forces each attachment to be an opening or ending frame.
- This pack does not initiate a generation or spend BytePlus credits.

BytePlus confirms up-to-30-second generation in its [Seedance 2.5 announcement](https://www.byteplus.com/en/blog/dreamina-seedance2-5). Its [technical documentation](https://docs.byteplus.com/en/docs/Byteplus_LAS/video_gen_enhanced) lists reference inputs, audio, durations and resolution options. Availability can differ by interface/account. Checked August 30, 2026.

## 2. Attach the references

| File | Purpose |
| --- | --- |
| 01-creator-casting.png | Optional fictional presenter and natural home-studio casting reference. |
| 02-brand-art-direction.png | Palette, photographic texture, type and mood. Not a shot to animate. |
| 03-workflow-reference.png | Illustrative source-to-Shorts-to-schedule workflow. Not analytics evidence. |
| 04-official-brand-mark.png | Original brand mark copied unchanged for the CTA. |

If your interface assigns attachment tokens, associate the actual tokens with these roles in the prompt. Do not assume filename mentions alone bind an attachment in every interface.

Important: BytePlus restricts some realistic-face image/video inputs. The woman here is AI-generated and fictional, but that does not guarantee the platform will accept a realistic face reference. If it is rejected, omit image 01 and use an approved virtual human from the platform's library, or a properly authorized likeness workflow. Keep the other three references. Do not try to disguise or crop a face to bypass the restriction.

## 3. Paste MASTER-PROMPT.txt

Generate the entire 30-second film as one clip so the narrator, casting and music have one continuous context. Do not request five separate 10-second clips for this version.

The master prompt includes the product context, reference roles, flexible beat timings, art direction, exact voiceover and constraints. It gives Seedance room to direct the coverage without giving it room to invent performance claims.

## 4. Voice direction

For this test, use a single generated female voice with a clear, warm, confident mid register and a conversational, lightly playful delivery. The script is 64 words; it should fit 30 seconds with natural pauses.

Erinome was the previous Google Flow choice. Do not assume that name is a BytePlus preset. If you need the exact previous sound, use a clean narration/audio reference only where the platform supports it and you have permission to reuse the audio. Matching a written description does not guarantee the same voice across separate generations.

## 5. Check the result before publishing

- The voice says the script once, with no missed words, and the female voice remains consistent.
- The clipping action is understandable; the source footage remains recognizable in the vertical outputs.
- Creator approval precedes scheduling. Autopilot is not portrayed as a guarantee of growth.
- The presenter, hands and physical devices remain plausible.
- The UI stays stable and there are no fabricated analytics or testimonials.
- The end card is visible for about three seconds. Check the logo, two-o spelling in Shoort Clips and shoortclips.com.
- If text or the logo is misspelled/distorted, place the original logo and exact CTA text over the final shot in an editor. Prompting cannot guarantee pixel-perfect marks or interface labels.
- Review at normal playback speed with sound, then muted: the main workflow should still be understandable.

## Why there is no analytics shot in this test

The client screenshot is factual evidence, and previous image-to-video attempts altered it. This first 30-second generation explains the product without regenerating that evidence. If you want to restore the proof section later, insert the untouched original screenshot in an editor; do not synthesize replacement numbers or charts.

## Files and provenance

Three new reference images were made with the built-in image-generation tool. The existing fictional creator reference informed casting, and the supplied brand mark informed the board and illustrative UI. Image 04 is an unchanged copy of the original logo. Full reference-generation prompts are in IMAGE-GENERATION-PROMPTS.md.

No video was generated, no BytePlus upload was made, and the website was not changed by producing this pack.
