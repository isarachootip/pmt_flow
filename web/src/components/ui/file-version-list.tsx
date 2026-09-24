import * as React from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

export interface FileVersion {
  id: string;
  version: number;
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'dwg' | 'skp' | 'other';
  isCurrent?: boolean;
}

export interface FileVersionListProps extends React.HTMLAttributes<HTMLDivElement> {
  files: FileVersion[];
}

const FileVersionList = React.forwardRef<HTMLDivElement, FileVersionListProps>(
  ({ files, className, ...props }, ref) => {
    const [previewFile, setPreviewFile] = React.useState<FileVersion | null>(null);

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props}>
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white p-3 shadow-sm transition-colors hover:bg-[var(--bg-subtle)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-softer)] text-[var(--primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-black">v{file.version}</span>
                  {file.isCurrent && (
                    <Badge variant="default" className="text-[10px]">
                      Current
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-[var(--text-secondary)]">{file.name}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {['pdf', 'image'].includes(file.type) ? (
                <Button variant="ghost" size="icon" onClick={() => setPreviewFile(file)}>
                  <Eye className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" asChild>
                  <a href={file.url} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Preview v{previewFile?.version} - {previewFile?.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-[var(--bg-subtle)] rounded-md border border-[var(--border)] flex items-center justify-center p-4">
              {previewFile?.type === 'image' && (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-full max-w-full object-contain" />
              )}
              {previewFile?.type === 'pdf' && (
                <iframe src={previewFile.url} className="h-full w-full rounded-md" title={previewFile.name} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
FileVersionList.displayName = 'FileVersionList';

export { FileVersionList };
