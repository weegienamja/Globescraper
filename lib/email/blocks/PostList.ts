/**
 * PostList block: linked list of articles/posts.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface PostListFields {
  posts: { title: string; url: string; desc?: string }[];
}

export function renderPostList(fields: PostListFields): string {
  const rows = fields.posts
    .map(
      (p) => `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${tokens.border};">
      <a href="${esc(p.url)}" style="font-family:${tokens.fontFamily};font-size:15px;font-weight:700;color:${tokens.accent};text-decoration:none;">
        ${esc(p.title)}
      </a>
      ${p.desc ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.45;color:${tokens.mutedText};">${esc(p.desc)}</p>` : ""}
    </td>
  </tr>`,
    )
    .join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  ${rows}
</table>`;
}

export function postListText(fields: PostListFields): string {
  return fields.posts
    .map((p) => `- ${p.title}: ${p.url}${p.desc ? `\n  ${p.desc}` : ""}`)
    .join("\n");
}
