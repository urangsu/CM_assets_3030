import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, AlertCircle, ShieldAlert, Lock } from 'lucide-react';
import { DEPARTMENTS, STORAGE_KEYS } from '../constants';
import { verifyPassword } from '../lib/auth';
import Footer from '../components/Footer';

export default function Login() {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  useEffect(() => {
    const savedFailed = localStorage.getItem('login_failed_attempts');
    const savedLockout = localStorage.getItem('login_lockout_until');
    
    if (savedFailed) setFailedAttempts(parseInt(savedFailed));
    if (savedLockout) {
      const until = parseInt(savedLockout);
      if (until > Date.now()) {
        setLockoutUntil(until);
      } else {
        localStorage.removeItem('login_lockout_until');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockoutUntil && lockoutUntil > Date.now()) {
      const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
      setError(`보호 조치 중입니다. ${remainingMinutes}분 후에 다시 시도해주세요.`);
      return;
    }

    // Get all users and their settings
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    const savedCustomUsers = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];

    // 1. Find the user by ID first to check protection status
    let targetUserCode = null;
    let targetUserName = null;

    // Check base departments
    for (const dept of DEPARTMENTS) {
      const userSetting = settings[dept.code] || { id: dept.code, password: dept.code };
      if (id === userSetting.id) {
        targetUserCode = dept.code;
        targetUserName = dept.manager;
        break;
      }
    }

    // Check custom users
    if (!targetUserCode) {
      for (const user of customUsers) {
        const userSetting = settings[user.code];
        if (userSetting && id === userSetting.id) {
          targetUserCode = user.code;
          targetUserName = user.name;
          break;
        }
      }
    }

    // Admin check
    if (id === 'admin@cleanmetal.com' || id === '99999') {
      targetUserCode = '99999';
      targetUserName = '운영자';
    }

    // 2. Check if the found user is protected
    if (targetUserCode && settings[targetUserCode]?.isProtected) {
      alert('보호조치가 시행중입니다. 관리자에게 문의하세요');
      setError('보호조치가 시행중입니다. 관리자에게 문의하세요');
      return;
    }

    // 3. Authenticate
    let authenticatedUser = null;
    
    if (targetUserCode === '99999') {
      if (password === '99999') { // Admin 비밀번호 수정
        authenticatedUser = { code: '99999', name: '운영자' };
      }
    } else if (targetUserCode) {
      const userSetting = settings[targetUserCode] || { id: targetUserCode, password: targetUserCode };
      const storedPassword = userSetting.password;
      
      // 해싱된 비밀번호인지 확인 (SHA-256 해시는 64자)
      const isHashed = storedPassword.length === 64 && /^[0-9a-f]+$/.test(storedPassword);
      
      if (isHashed) {
        if (await verifyPassword(password, storedPassword)) {
          authenticatedUser = { code: targetUserCode, name: targetUserName };
        }
      } else {
        // 기존 평문 비밀번호와 비교 (마이그레이션용)
        if (password === storedPassword) {
          authenticatedUser = { code: targetUserCode, name: targetUserName };
          // 로그인 성공 시 해싱하여 저장 (자동 마이그레이션)
          /* 
          import { hashPassword } from '../lib/auth';
          const hashed = await hashPassword(password);
          settings[targetUserCode].password = hashed;
          localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
          */
        }
      }
    }

    if (authenticatedUser) {
      // Success
      localStorage.setItem('login_failed_attempts', '0');
      localStorage.removeItem('login_lockout_until');
      localStorage.setItem('current_user', JSON.stringify(authenticatedUser));
      navigate('/dashboard');
    } else {
      // Failure
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('login_failed_attempts', newAttempts.toString());

      // If we found a valid user ID but wrong password, we might need to protect them
      if (targetUserCode && targetUserCode !== '99999') {
        if (newAttempts >= 5) {
          // Set isProtected to true for this user
          const updatedSettings = {
            ...settings,
            [targetUserCode]: {
              ...(settings[targetUserCode] || { id: targetUserCode, password: targetUserCode }),
              isProtected: true
            }
          };
          localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(updatedSettings));
          alert('비밀번호 5회 오류로 인해 계정이 보호조치 되었습니다. 관리자에게 문의하세요.');
          setError('보호조치가 시행중입니다. 관리자에게 문의하세요');
          return;
        }
      }

      if (newAttempts >= 5) {
        const until = Date.now() + 10 * 60000; // 10 minutes lockout
        setLockoutUntil(until);
        localStorage.setItem('login_lockout_until', until.toString());
        setError('비밀번호를 5회 틀려 임시 보호 조치가 되었습니다. 10분 후 다시 시도해주세요.');
      } else if (newAttempts >= 3) {
        setError(`비밀번호를 ${newAttempts}회 틀렸습니다. 5회 오류 시 로그인이 제한됩니다.`);
        alert(`경고: 비밀번호를 ${newAttempts}회 틀렸습니다. 5회 연속 오류 시 10분간 로그인이 제한됩니다.`);
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Calculator className="w-8 h-8 text-brand-500" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-[#191f28]">
          클린메탈 예산 관리
        </h2>
        <p className="mt-2 text-center text-sm text-[#4e5968]">
          사내 예산 편성 및 관리 시스템
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-[#e5e8eb]">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                failedAttempts >= 5 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
              }`}>
                {failedAttempts >= 5 ? <ShieldAlert className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            <div>
              <label htmlFor="id" className="block text-sm font-medium text-[#191f28]">
                사번 또는 이메일
              </label>
              <div className="mt-2">
                <input
                  id="id"
                  name="id"
                  type="text"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-[#d1d6db] rounded-xl shadow-sm placeholder-[#8b95a1] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm transition-shadow disabled:bg-[#f2f4f6] disabled:cursor-not-allowed"
                  placeholder="사번을 입력해주세요"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#191f28]">
                비밀번호
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-[#d1d6db] rounded-xl shadow-sm placeholder-[#8b95a1] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm transition-shadow disabled:bg-[#f2f4f6] disabled:cursor-not-allowed"
                  placeholder="비밀번호를 입력해주세요"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-[#d1d6db] rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-[#4e5968]">
                  로그인 상태 유지
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-brand-600 hover:text-brand-500">
                  비밀번호를 잊으셨나요?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!!(lockoutUntil && lockoutUntil > Date.now())}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:bg-[#8b95a1] disabled:cursor-not-allowed flex items-center gap-2"
              >
                {lockoutUntil && lockoutUntil > Date.now() ? (
                  <>
                    <Lock className="w-4 h-4" />
                    보호 조치 중
                  </>
                ) : '로그인'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer isLoggedIn={false} />
    </div>
  );
}
