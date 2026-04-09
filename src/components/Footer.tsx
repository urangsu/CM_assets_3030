import React, { useState } from 'react';
import { X, Info, Mail, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FooterProps {
  isLoggedIn?: boolean;
}

export default function Footer({ isLoggedIn = false }: FooterProps) {
  const [activeModal, setActiveModal] = useState<'guide' | 'privacy' | null>(null);

  const closeModal = () => setActiveModal(null);

  const privacyContent = (
    <div className="space-y-6 text-[#4e5968] text-sm leading-relaxed">
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">1. 수집하는 개인정보 항목</h4>
        <p>• 필수항목: 사번(ID), 비밀번호(암호화 저장)</p>
        <p>• 선택항목: 성명, 소속 부서, 회사 이메일, 연락처</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">2. 개인정보의 수집 및 이용 목적</h4>
        <p>• 사내 예산 편성 및 관리 시스템 이용 권한 확인</p>
        <p>• 예산 제출/반려 시 알림 메일 발송 및 담당자 확인</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">3. 개인정보의 보유 및 이용 기간</h4>
        <p>• 퇴사 시 또는 시스템 운영 종료 시까지 (또는 사내 규정에 따름)</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">4. 개인정보의 파기 절차 및 방법</h4>
        <p>• 계정 삭제 시 시스템 내 저장된 데이터 즉시 파기</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">5. 보안 조치 사항</h4>
        <p>• 모든 비밀번호는 암호화되어 저장됩니다.</p>
        <p>• 사용자 관리 메뉴는 운영자 및 기획재무그룹 등 지정된 관리자만 이용가능합니다.</p>
        <p className="text-red-500 font-bold mt-2">※ 당사의 지정 사용자외 사용을 엄금한다.</p>
      </section>
    </div>
  );

  const guideContent = (
    <div className="space-y-6 text-[#4e5968] text-sm leading-relaxed">
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">1. 로그인 및 계정 관리</h4>
        <p>• 부여받은 사번과 비밀번호로 로그인합니다. 보안을 위해 최초 로그인 후 '내 정보 관리'에서 비밀번호를 변경하시기 바랍니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">2. 예산 계정 선택</h4>
        <p>• [예산 계정 선택] 메뉴에서 해당 부서에서 사용할 계정들을 체크하여 저장합니다. 선택된 계정만 예산 작성 화면에 나타납니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">3. 예산 작성 및 제출</h4>
        <p>• [예산 작성] 메뉴에서 월별 예산 금액을 입력합니다. 작성이 완료되면 우측 상단의 '제출' 버튼을 눌러 확정합니다.</p>
        <p className="text-red-500 font-medium mt-1">※ 제출 후에는 수정이 불가능하므로 관리자에게 반려 요청을 해야 합니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">4. 비교 분석</h4>
        <p>• [비교 분석] 메뉴를 통해 계획 대비 실적 현황을 그래프와 표로 한눈에 파악할 수 있습니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">5. 기타 문의</h4>
        <p>• 시스템 오류나 계정 관련 문의는 하단의 Feedback 링크를 통해 담당자에게 메일을 보내주시기 바랍니다.</p>
      </section>
    </div>
  );

  return (
    <>
      <footer className="mt-auto py-6 px-8">
        <div className="border-t border-[#e5e8eb] pt-6 flex justify-center items-center gap-6 text-xs font-medium text-[#8b95a1]">
          {isLoggedIn && (
            <>
              <button 
                onClick={() => setActiveModal('guide')}
                className="hover:text-brand-500 transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Guide
              </button>
              <span className="text-[#e5e8eb]">|</span>
              <a 
                href="mailto:su@poscohycm.com"
                className="hover:text-brand-500 transition-colors flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Feedback
              </a>
              <span className="text-[#e5e8eb]">|</span>
            </>
          )}
          <button 
            onClick={() => setActiveModal('privacy')}
            className="hover:text-brand-500 transition-colors flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            Privacy
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center bg-[#f9fafb]">
                <h3 className="text-lg font-bold text-[#191f28] flex items-center gap-2">
                  {activeModal === 'guide' ? (
                    <><BookOpen className="w-5 h-5 text-brand-500" /> 사용 가이드라인</>
                  ) : (
                    <><Info className="w-5 h-5 text-brand-500" /> 개인정보 처리방침</>
                  )}
                </h3>
                <button 
                  onClick={closeModal}
                  className="p-2 text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {activeModal === 'guide' ? guideContent : privacyContent}
              </div>
              <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end">
                <button 
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
