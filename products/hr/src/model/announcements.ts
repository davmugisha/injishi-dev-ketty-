/** Announcements as HR's Staff services shows and posts them. What a person reads of them is in `staff.ts`. */

export interface HrAnnouncement {
  id: string;
  title: string;
  body: string;
  /** "Everyone", or who it names. */
  audience: string;
  /** "6 Nov". */
  posted: string;
  /** "20 Nov"; null when it has no end date. */
  until: string | null;
  status: "showing" | "ended" | "down";
}

/** Who an announcement can be aimed at, beside the people HR already lists. */
export interface AnnouncementAudience {
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
}

export type AnnouncementFor = "all" | "department" | "position" | "person";

export interface NewAnnouncement {
  title: string;
  body: string;
  who: AnnouncementFor;
  /** The department, position or person; empty for everyone. */
  targetId: string;
  /** Empty: it stays up until taken down. */
  expiresOn: string;
}
