import { getAllDepartments } from '../constants';

export const DEPT_GROUPS_STORAGE_KEY = 'hycm_dept_groups';

export interface DeptGroup {
  id: string;
  name: string;
  parentId?: string | null;
  description?: string;
  deptCodes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const now = () => new Date().toISOString();

export const DEFAULT_DEPT_GROUPS: DeptGroup[] = [
  {
    id: 'PLANT_1',
    name: '1공장',
    parentId: null,
    description: '1공장 및 주요 공정 부서',
    deptCodes: [
      '50200', // 1공장
      '50201', // 물류반
      '50210', // 침출파트
      '50220', // 추출파트
      '50240', // 결정화파트
      '50250', // 리튬파트
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'MAINTENANCE_SECTION',
    name: '설비관리섹션',
    parentId: null,
    description: '기계·전기 설비 관련 부서',
    deptCodes: [
      '50600', // 설비관리섹션
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'MECHANICAL_PART',
    name: '기계파트',
    parentId: 'MAINTENANCE_SECTION',
    description: '설비관리섹션 하위 기계파트',
    deptCodes: [
      '50610', // 기계파트
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'ELECTRICAL_PART',
    name: '전기파트',
    parentId: 'MAINTENANCE_SECTION',
    description: '설비관리섹션 하위 전기파트',
    deptCodes: [
      '50620', // 전기파트
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'QUALITY_TECH_DEPT',
    name: '품질기술부',
    parentId: null,
    description: '품질기술 관련 부서',
    deptCodes: [
      '50400', // 품질기술부
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'QUALITY_ANALYSIS_SECTION',
    name: '품질분석섹션',
    parentId: 'QUALITY_TECH_DEPT',
    description: '품질기술부 하위 품질분석섹션',
    deptCodes: [
      '50410', // 품질분석섹션
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'ANALYSIS_PART',
    name: '분석파트',
    parentId: 'QUALITY_ANALYSIS_SECTION',
    description: '품질분석섹션 하위 분석파트',
    deptCodes: [
      '50411', // 분석파트
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'QUALITY_TECH_SECTION',
    name: '품질기술섹션',
    parentId: 'QUALITY_TECH_DEPT',
    description: '품질기술부 하위 품질기술섹션',
    deptCodes: [
      '50420', // 품질기술섹션
    ],
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

export function getDeptGroups(): DeptGroup[] {
  const saved = localStorage.getItem(DEPT_GROUPS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_DEPT_GROUPS;
    }
  }
  // Initialize default if not present
  localStorage.setItem(DEPT_GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_DEPT_GROUPS));
  return DEFAULT_DEPT_GROUPS;
}

export function saveDeptGroups(groups: DeptGroup[]) {
  localStorage.setItem(DEPT_GROUPS_STORAGE_KEY, JSON.stringify(groups));
}

export function getDeptNameByCode(code: string): string {
  // Try retrieving from custom dept list first
  const rawCustom = localStorage.getItem('cleanmetal_dept_master_custom');
  if (rawCustom) {
    try {
      const parsed = JSON.parse(rawCustom);
      const found = parsed.find((d: any) => d.code === code);
      if (found) return found.name;
    } catch (e) {
      // fallback
    }
  }
  const dept = getAllDepartments().find(d => d.code === code);
  return dept?.name || code;
}

export function getDeptCodesByGroup(groupId: string, includeChildren = true): string[] {
  const groups = getDeptGroups().filter(g => g.isActive !== false);
  const group = groups.find(g => g.id === groupId);
  if (!group) return [];

  const codes = new Set<string>(group.deptCodes || []);

  if (includeChildren) {
    groups
      .filter(g => g.parentId === groupId)
      .forEach(child => {
        getDeptCodesByGroup(child.id, true).forEach(code => codes.add(code));
      });
  }

  return Array.from(codes);
}
