export interface NoteMeta {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
}

export interface Note extends NoteMeta {
  body: string;
}

export interface NewNoteInput {
  title: string;
  body: string;
  tags: string[];
}

export interface NotePatchInput {
  title?: string;
  body?: string;
  tags?: string[];
}

export interface SearchInput {
  text: string;
  tags: string[];
}
