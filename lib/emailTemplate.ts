// Shared HTML shell for every account email — table-based layout with
// inline styles throughout, not CSS custom properties or flexbox/grid:
// email clients (Outlook desktop in particular, via its Word rendering
// engine) don't reliably support either, so this hand-codes the same
// Porcelain/Graphite/Alabaster Grey palette app/globals.css defines as
// CSS variables. 💡 stands in for a real logo until one exists — same
// placeholder already used for the app favicon (app/icon.tsx).
//
// Deliberately duplicated in worker/lib/emailTemplate.ts rather than
// shared — separate npm packages, same convention as email.ts/tokens.ts.

const GRAPHITE = "#333533";
const BORDER = "#cfdbd5";
const MUTED = "#7a8c88";

export function renderEmailHtml(opts: { heading: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#fefefa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fefefa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="background-color:${GRAPHITE};border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
                <span style="font-size:28px;line-height:1;">&#128161;</span>
                <div style="color:#ffffff;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  StudyBeacon
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:32px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:${GRAPHITE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${opts.heading}
                </h1>
                <div style="font-size:14px;line-height:1.6;color:${GRAPHITE};">
                  ${opts.bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px;text-align:center;">
                <p style="margin:0;font-size:12px;color:${MUTED};">A Light Patterns product</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:${GRAPHITE};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${label}</a>`;
}
