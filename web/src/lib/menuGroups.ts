import type { Page } from "./url";

export interface MenuItem {
  page: Page;
  label: string;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

// groups header primary tabs and secondary links into Main and More sections, omitting empty groups
export function menuGroups(
  primary: readonly [Page, string][],
  learn: readonly [Page, string][],
): MenuGroup[] {
  const groups: MenuGroup[] = [];
  if (primary.length > 0) {
    groups.push({
      title: "Main",
      items: primary.map(([page, label]) => ({ page, label })),
    });
  }
  if (learn.length > 0) {
    groups.push({
      title: "More",
      items: learn.map(([page, label]) => ({ page, label })),
    });
  }
  return groups;
}
