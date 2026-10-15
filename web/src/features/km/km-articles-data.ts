import { KmArticle } from './types';
import { GENERAL_ARTICLES } from './articles-general';
import { OPERATIONS_ARTICLES } from './articles-operations';

export * from './types';

export const KM_ARTICLES: KmArticle[] = [
  ...GENERAL_ARTICLES,
  ...OPERATIONS_ARTICLES,
];
