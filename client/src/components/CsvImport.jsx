import { useState } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, errMsg } from '../lib/api';
import { Modal } from './ui';

// Import answers/inputs from a CSV; offers the matching template for download
export default function CsvImport({ open, onClose, projectId, moduleId, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const template = async () => {
    try {
      const r = await post(`/module/sample/${moduleId}`);
      const blob = new Blob([atob(r.data.base64Url)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `m3m-one-template-module-${moduleId}.csv`; a.click();
    } catch (e) { toast.error(errMsg(e, 'Could not download template')); }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post(`/project/${projectId}/module/${moduleId}/import`, fd);
      toast.success(res.data.message || 'Imported');
      onImported?.(res.data.data);
      setFile(null); onClose();
    } catch (e) { toast.error(errMsg(e, 'Import failed')); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import from CSV" footer={<>
      <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="btn-primary" disabled={!file || busy} onClick={upload}><Upload className="h-4 w-4" />{busy ? 'Importing…' : 'Import'}</button>
    </>}>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-600">
        <li>Download the template — it lists every field for this module.</li>
        <li>Fill in the values column. Leave a row blank to skip it.</li>
        <li>Upload the file (CSV, up to 5 MB). Imported values are saved as a draft for you to review.</li>
      </ol>
      <button type="button" className="btn-secondary mb-4 w-full" onClick={template}><Download className="h-4 w-4" />Download template</button>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ink-200 px-4 py-6 text-center hover:border-brand-400">
        {file ? <span className="flex items-center gap-2 text-sm font-medium text-ink-800"><FileText className="h-4 w-4" />{file.name}</span>
          : <span className="text-sm text-ink-500">Click to choose a .csv file</span>}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
    </Modal>
  );
}
