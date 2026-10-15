export type KmCategory = 'General' | 'Operation' | 'Quality' | 'Finance' | 'MA';

export interface KmArticle {
  id: number;
  code: string;
  title: string;
  category: KmCategory;
  updatedAt: string;
  summary: string;
  content: string;
}
