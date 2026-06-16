import { getBudgetDataKey } from './storageKeys';
import { STORAGE_KEYS, getAllDepartments } from '../constants';
import { loadExistingRowsForUploadTarget } from '../pages/PlanActualUpload';
import { BudgetRepository } from '../repositories/BudgetRepository';

export function runSecondRpUploadIsolationTest(): { success: boolean; message: string } {
  const dept = '21002';
  const year = '2026';

  // Back up original keys
  const bizBackup = localStorage.getItem(getBudgetDataKey(dept, year, '경영계획'));
  const rp1Backup = localStorage.getItem(getBudgetDataKey(dept, year, '1차 RP'));
  const rp2Backup = localStorage.getItem(getBudgetDataKey(dept, year, '2차 RP'));
  const legacyRp2Backup = localStorage.getItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`);
  const legacyRp2SpaceBackup = localStorage.getItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_RP 2`);

  try {
    // 1. Setup isolated data
    localStorage.setItem(
      getBudgetDataKey(dept, year, '경영계획'),
      JSON.stringify([{ code: 'A60601115', name: '제조비용_복리후생비_보건위생지원', values: [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }])
    );

    localStorage.setItem(
      getBudgetDataKey(dept, year, '1차 RP'),
      JSON.stringify([{ code: 'A60601115', name: '제조비용_복리후생비_보건위생지원', values: [2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }])
    );

    localStorage.removeItem(getBudgetDataKey(dept, year, '2차 RP'));
    localStorage.removeItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`);
    localStorage.removeItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_RP 2`);

    // 2. Validate empty 2차 RP load
    const existingRows = loadExistingRowsForUploadTarget({
      year,
      uploadTarget: '2차 RP',
      currentUser: { code: '99999' },
      viewableDepts: getAllDepartments(),
    });

    if (existingRows.length !== 0) {
      throw new Error(`2차 RP existingRows should be 0, got ${existingRows.length}`);
    }

    // 3. Setup and validate legacy key alignment
    localStorage.setItem(
      `${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`,
      JSON.stringify([{ code: 'A60601115', name: '제조비용_복리후생비_보건위생지원', values: [3000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], attributedDeptCode: dept }])
    );

    const legacyExistingRows = loadExistingRowsForUploadTarget({
      year,
      uploadTarget: '2차 RP',
      currentUser: { code: '99999' },
      viewableDepts: getAllDepartments(),
    });

    if (legacyExistingRows.length === 0) {
      throw new Error('Legacy alias key 2차RP was not parsed or detected.');
    }

    const firstVal = legacyExistingRows[0].amount;
    if (firstVal !== 3000) {
      throw new Error(`Expected legacy value 3000, got ${firstVal}`);
    }

    // 4. Save and check legacy cleanups
    const newRowsToSave = [
      { code: 'A60601115', name: '제조비용_복리후생비_보건위생지원', values: [4000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], attributedDeptCode: dept }
    ];
    BudgetRepository.saveRows(dept, year, '2차 RP', newRowsToSave);

    // After normalized save, the legacy key should be deleted
    const checkLegacy = localStorage.getItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`);
    if (checkLegacy !== null) {
      throw new Error('Legacy key was not cleaned after saveRows.');
    }

    // Normalize check
    const checkNormal = localStorage.getItem(getBudgetDataKey(dept, year, '2차 RP'));
    if (!checkNormal) {
      throw new Error('Normalized 2차 RP key was not saved correctly.');
    }

    return {
      success: true,
      message: '2차 RP isolation and legacy key cleanup tests PASSED successfully!',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Test Failed: ${error.message || error}`,
    };
  } finally {
    // Restore backups
    if (bizBackup !== null) localStorage.setItem(getBudgetDataKey(dept, year, '경영계획'), bizBackup);
    else localStorage.removeItem(getBudgetDataKey(dept, year, '경영계획'));

    if (rp1Backup !== null) localStorage.setItem(getBudgetDataKey(dept, year, '1차 RP'), rp1Backup);
    else localStorage.removeItem(getBudgetDataKey(dept, year, '1차 RP'));

    if (rp2Backup !== null) localStorage.setItem(getBudgetDataKey(dept, year, '2차 RP'), rp2Backup);
    else localStorage.removeItem(getBudgetDataKey(dept, year, '2차 RP'));

    if (legacyRp2Backup !== null) localStorage.setItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`, legacyRp2Backup);
    else localStorage.removeItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_2차RP`);

    if (legacyRp2SpaceBackup !== null) localStorage.setItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_RP 2`, legacyRp2SpaceBackup);
    else localStorage.removeItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept}_${year}_RP 2`);
  }
}
