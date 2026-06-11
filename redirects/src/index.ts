// Thin 301 redirector for the retired subdomains after the suite merge.
// Deploy this Worker on tix.eypi.cc/* and forms.eypi.cc/* so existing links
// (especially already-shared public ticket URLs) keep working.
//
//   forms.eypi.cc/*            -> https://eypi.cc/forms
//   tix.eypi.cc/<slug>         -> https://eypi.cc/event/<slug>   (public ticket link)
//   tix.eypi.cc/ (and deeper)  -> https://eypi.cc/events         (management; re-auth on suite)

export default {
  fetch(req: Request): Response {
    const url = new URL(req.url)
    const host = url.hostname
    let target: string

    if (host.startsWith('forms.')) {
      target = 'https://eypi.cc/forms'
    } else if (host.startsWith('tix.')) {
      const segments = url.pathname.split('/').filter(Boolean)
      // A single path segment is a shared public ticket link (formerly tix.eypi.cc/<slug>).
      target = segments.length === 1
        ? `https://eypi.cc/event/${segments[0]}`
        : 'https://eypi.cc/events'
    } else {
      target = 'https://eypi.cc/'
    }

    return Response.redirect(target, 301)
  },
}
