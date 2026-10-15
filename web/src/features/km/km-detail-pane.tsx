import { BookOpen, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KmArticle } from './types';

interface KmDetailPaneProps {
  article: KmArticle;
  getCategoryBadge: (category: string) => string;
}

export function KmDetailPane({ article, getCategoryBadge }: KmDetailPaneProps) {
  return (
    <div className="flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm p-6 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getCategoryBadge(article.category)}`}>
                {article.category}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-700">{article.code}</span>
            </div>
            <h2 className="text-lg font-bold text-black mt-0.5">{article.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">ปรับปรุงเมื่อ: {article.updatedAt}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()} 
            className="gap-1.5 text-xs text-black border-slate-300 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์คู่มือ</span>
          </Button>
        </div>
      </div>

      <div className="py-4 space-y-4 max-w-4xl">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            สรุปใจความสำคัญ (Summary)
          </span>
          <p className="text-xs font-semibold text-black leading-relaxed">
            {article.summary}
          </p>
        </div>

        <div className="prose prose-sm text-black space-y-3 leading-relaxed whitespace-pre-line text-xs font-medium">
          {article.content}
        </div>
      </div>
    </div>
  );
}
