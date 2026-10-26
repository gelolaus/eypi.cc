# Operations

## Form templates in R2

The `.docx` templates are not in git. Keep the originals in a private backup outside this repository. A clean checkout does not contain them, and the public site does not serve the `templates/` prefix.

The bucket is `eypi-media`. The backend reads each file from the `MEDIA` binding at `templates/<file>`. Activated org members download it through `GET /api/forms/templates/<file>`.

Upload each file once, from `backend/`, with the Cloudflare account that owns the bucket. Do not commit the files. Do not point this command at a different bucket.

```bash
wrangler r2 object put eypi-media/templates/<file> --file <path>
```

`<file>` is the object name. `<path>` is the local backup. The allowlist is:

- `concessionaire_reply_form.docx`
- `memorandum_of_agreement.docx`
- `terms_and_conditions.docx`
- `waiver_form.docx`
- `products_and_equipments.docx`
- `visitors_pass.docx`
- `letter_of_intent_and_waiver.docx`

Example:

```bash
wrangler r2 object put eypi-media/templates/waiver_form.docx --file ./waiver_form.docx
```

Repeat for every file above. Re-run the same command to replace a file. Until an allowlisted file is uploaded, the form API returns `template_missing`.
