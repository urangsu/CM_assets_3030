import ActualImportMonthSelector from '../components/ActualImportMonthSelector';
import PlanActualUpload from './PlanActualUpload';

export default function PlanActualUploadWorkspace() {
  return (
    <div className="space-y-4">
      <ActualImportMonthSelector />
      <PlanActualUpload />
    </div>
  );
}
