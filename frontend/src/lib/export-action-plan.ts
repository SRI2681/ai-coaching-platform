import type { ActionItem, ActionPlan } from '@/lib/api';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadActionPlanExcel(
  plan: ActionPlan,
  items: ActionItem[],
  candidateName: string
): void {
  const focusAreas = (plan.focus_areas || []).join('; ') || '—';
  const rows = items.map((item) => [
    item.kind,
    item.title,
    item.detail || '',
    item.due_date || '',
    item.is_completed ? 'Yes' : 'No',
    item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '',
  ]);

  const header = ['Type', 'Title', 'Detail', 'Due date', 'Completed', 'Completed on'];
  const allRows = [header, ...rows];

  const sheetRows = allRows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`).join('')}</Row>`
    )
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Action Plan">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Candidate</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(candidateName)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Focus areas</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(focusAreas)}</Data></Cell>
   </Row>
   <Row></Row>
   ${sheetRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `action-plan-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}
