'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface Profile {
  id: string;
  full_name: string;
  daily_wage?: number;
  monthly_wage?: number;
  salary_type?: 'daily' | 'monthly';
  default_site_id?: string;
  role?: string;
}

interface WorkSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  radius?: number;
}

interface Log {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  bonus_hours?: number;
  work_area?: string;
  cash_advance?: number;
  profiles: {
    full_name: string;
    daily_wage?: number;
    monthly_wage?: number;
    salary_type?: 'daily' | 'monthly';
  } | null;
}

export default function Dashboard() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<'attendance' | 'employees' | 'sites'>('attendance');

  // --- Site Modal State ---
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLat, setSiteLat] = useState(0);
  const [siteLng, setSiteLng] = useState(0);
  const [siteRadius, setSiteRadius] = useState(500);

  // --- Filtering ---
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // --- Auth & Init ---
  useEffect(() => { checkAuth(); }, []);
  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, selectedMonth, selectedEmployeeId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) router.push('/login');
    else setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchData = async () => {
    const { data: sites } = await supabase.from('work_sites').select('*').order('created_at');
    if (sites) setWorkSites(sites);

    const { data: profileData } = await supabase.from('profiles').select('*').order('full_name');
    if (profileData) setProfiles(profileData);

    let query = supabase
      .from('attendance_logs')
      .select('*, profiles!user_id(full_name, daily_wage, monthly_wage, salary_type)')
      .order('check_in_time', { ascending: false });

    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startStr = `${selectedMonth}-01T00:00:00`;
      let nextYear = year;
      let nextMonth = month + 1;
      if (nextMonth > 12) { nextMonth = 1; nextYear++; }
      const endStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00`;
      query = query.gte('check_in_time', startStr).lt('check_in_time', endStr);
    }
    if (selectedEmployeeId) { query = query.eq('user_id', selectedEmployeeId); }

    const { data, error } = await query;
    if (error) console.error('Error fetching logs:', error);
    else setLogs(data || []);
  };

  // --- Helpers ---
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };
  const formatTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const calculateDurationNumber = (start: string, end: string | null) => {
    if (!end) return 0;
    return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
  };

  const calculateDisplayDuration = (start: string, end: string | null, bonus: number = 0) => {
    const hours = calculateDurationNumber(start, end);
    if (hours === 0 && !end) return '-';
    return `${(hours + (bonus || 0)).toFixed(1)} hrs`;
  };

  const calculateConstructionPay = (log: Log) => {
    const p = log.profiles;
    if (p?.salary_type === 'monthly') return 0; // Handled separately

    if (!log.check_out_time) return 0;
    const dailyWage = p?.daily_wage || 0;
    const basePay = dailyWage;
    const hourlyRate = dailyWage / 8;
    const otPay = (log.bonus_hours || 0) * hourlyRate;
    const total = basePay + otPay - (log.cash_advance || 0);
    return total > 0 ? Math.floor(total) : 0;
  };

  // --- Export ---
  const handleExport = () => {
    if (logs.length === 0) return;
    const headers = ['員工姓名', '日期', '上班', '下班', '工區', '工時', '薪資類型', '日薪/月薪', 'OT', '預支', '實領薪資', '狀態'];
    const csvRows = [headers.join(',')];
    logs.forEach(log => {
      const p = log.profiles;
      const salaryType = p?.salary_type === 'monthly' ? '月薪' : '日薪';
      const wageVal = p?.salary_type === 'monthly' ? p.monthly_wage : p?.daily_wage;
      const total = p?.salary_type === 'monthly' ? '月薪制' : calculateConstructionPay(log);

      const row = [
        p?.full_name || '未知',
        formatDate(log.check_in_time),
        formatTime(log.check_in_time),
        formatTime(log.check_out_time),
        log.work_area || '-',
        calculateDisplayDuration(log.check_in_time, log.check_out_time, log.bonus_hours),
        salaryType,
        wageVal || 0,
        log.bonus_hours || 0,
        log.cash_advance || 0,
        total,
        log.status === 'late' ? '異常' : '正常'
      ].map(f => `"${f}"`).join(',');
      csvRows.push(row);
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'payroll_report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Selection ---
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(logs.map(l => l.id)) : new Set());
  };
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm('確定刪除?')) return;
    await supabase.from('attendance_logs').delete().in('id', Array.from(selectedIds));
    setLogs(logs.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set());
  };

  // --- Modals State ---
  // 1. Attendance Record Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState('');
  const [formCheckIn, setFormCheckIn] = useState('');
  const [formCheckOut, setFormCheckOut] = useState('');
  const [formBonus, setFormBonus] = useState(0);
  const [formWorkArea, setFormWorkArea] = useState('');
  const [formAdvance, setFormAdvance] = useState(0);

  // 2. Staff Registration Modal
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSalaryType, setRegSalaryType] = useState<'daily' | 'monthly'>('daily');
  const [regWage, setRegWage] = useState(0);
  const [regSiteId, setRegSiteId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // 3. Staff Edit Modal
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empFormId, setEmpFormId] = useState('');
  const [empFormName, setEmpFormName] = useState('');
  const [empFormSalaryType, setEmpFormSalaryType] = useState<'daily' | 'monthly'>('daily');
  const [empFormWage, setEmpFormWage] = useState(0);
  const [empFormSiteId, setEmpFormSiteId] = useState('');

  const [empFormEmail, setEmpFormEmail] = useState('');
  const [empFormPassword, setEmpFormPassword] = useState('');
  // --- Logic: Attendance Modal ---
  const openCreateModal = () => {
    setIsCreateMode(true);
    setFormUserId(''); setFormCheckIn(''); setFormCheckOut('');
    setFormBonus(0); setFormWorkArea(''); setFormAdvance(0);
    setIsModalOpen(true);
  };
  const openEditModal = (log: Log) => {
    setIsCreateMode(false);
    setFormId(log.id);
    setFormUserId(log.user_id);
    setFormCheckIn(log.check_in_time.slice(0, 16)); // simplify
    setFormCheckOut(log.check_out_time ? log.check_out_time.slice(0, 16) : '');
    setFormBonus(log.bonus_hours || 0);
    setFormWorkArea(log.work_area || '');
    setFormAdvance(log.cash_advance || 0);
    setIsModalOpen(true);
  };
  const handleSaveRecord = async () => {
    if (!formUserId || !formCheckIn) return alert('Missing fields');
    const payload = {
      check_in_time: new Date(formCheckIn).toISOString(),
      check_out_time: formCheckOut ? new Date(formCheckOut).toISOString() : null,
      bonus_hours: formBonus,
      work_area: formWorkArea,
      cash_advance: formAdvance
    };
    try {
      if (isCreateMode) await supabase.from('attendance_logs').insert([{ user_id: formUserId, status: 'regular', ...payload }]);
      else await supabase.from('attendance_logs').update(payload).eq('id', formId);
      setIsModalOpen(false); fetchData();
    } catch (e: any) { alert(e.message); }
  };

  // --- Logic: Register Staff ---
  const openRegModal = () => {
    setRegName(''); setRegEmail(''); setRegPassword('');
    setRegSalaryType('daily'); setRegWage(0); setRegSiteId('');
    setIsRegModalOpen(true);
  };
  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) return alert('Incomplete Info');
    setIsRegistering(true);
    try {
      const body = {
        name: regName, email: regEmail, password: regPassword,
        salary_type: regSalaryType,
        default_site_id: regSiteId,
        daily_wage: regSalaryType === 'daily' ? regWage : 0,
        monthly_wage: regSalaryType === 'monthly' ? regWage : 0,
      };
      const res = await fetch('/api/employees/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('建立成功'); setIsRegModalOpen(false); fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setIsRegistering(false); }
  };

  // --- Logic: Edit Staff ---
  const openEmpEditModal = (p: Profile) => {
    setEmpFormId(p.id); setEmpFormName(p.full_name);
    setEmpFormSalaryType(p.salary_type || 'daily');
    setEmpFormWage(p.salary_type === 'monthly' ? (p.monthly_wage || 0) : (p.daily_wage || 0));
    setEmpFormSiteId(p.default_site_id || '');
    setEmpFormEmail('');
    setEmpFormPassword('');
    setIsEmpModalOpen(true);
  };
  const handleSaveEmployee = async () => {
    try {
      const updates = {
        salary_type: empFormSalaryType,
        default_site_id: empFormSiteId || null,
        daily_wage: empFormSalaryType === 'daily' ? empFormWage : 0,
        monthly_wage: empFormSalaryType === 'monthly' ? empFormWage : 0
      };
      await supabase.from('profiles').update(updates).eq('id', empFormId);

      if (empFormEmail || empFormPassword) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: empFormId,
            email: empFormEmail || undefined,
            password: empFormPassword || undefined
          })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        alert('Updates saved (Profile & Credentials)!');
      } else {
        alert('Updates saved (Profile only)!');
      }

      setIsEmpModalOpen(false); fetchData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user "${name}"? This cannot be undone and they will lose access immediately.`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('User deleted successfully');
      fetchData();
    } catch (e: any) { alert(e.message); }
  };

  // --- Logic: Sites ---
  const openSiteModal = (site?: WorkSite) => {
    if (site) {
      setEditingSiteId(site.id); setSiteName(site.name);
      setSiteLat(site.latitude); setSiteLng(site.longitude); setSiteRadius(site.radius_meters || 500);
    } else {
      setEditingSiteId(null); setSiteName('');
      setSiteLat(0); setSiteLng(0); setSiteRadius(500);
    }
    setIsSiteModalOpen(true);
  };
  const handleSaveSite = async () => {
    // 1. Extract values explicitly
    const newName = siteName;
    const newLat = Number(siteLat);
    const newLng = Number(siteLng);
    const newRadius = Number(siteRadius);

    if (!newName || !newLat || !newLng) return alert('Incomplete Info');

    try {
      // 2. Prepare Payload for DB (radius_meters)
      const payload = {
        name: newName,
        latitude: newLat,
        longitude: newLng,
        radius_meters: newRadius
      };

      if (editingSiteId) {
        // --- UPDATE MODE ---
        const { error } = await supabase.from('work_sites').update(payload).eq('id', editingSiteId);
        if (error) throw error;

        // 3. FORCE Local State Update (Aggressive)
        // We update both 'radius_meters' AND 'radius' to ensure the UI catches it regardless of what it's looking for.
        setWorkSites(prev => prev.map(site => {
          if (site.id === editingSiteId) {
            return {
              ...site,
              name: newName,
              latitude: newLat,
              longitude: newLng,
              radius_meters: newRadius,
              radius: newRadius // Fallback alias
            };
          }
          return site;
        }));
        alert('工區更新成功 (Site Updated)');
      } else {
        // --- CREATE MODE ---
        const { error } = await supabase.from('work_sites').insert([payload]);
        if (error) throw error;

        alert('工區建立成功');
        await fetchData();
      }
      setIsSiteModalOpen(false);
    } catch (e: any) { alert(e.message); }
  };
  const handleDeleteSite = async (id: string) => {
    if (!confirm('確定刪除此工區? (Associated staff will become unbound)')) return;
    await supabase.from('work_sites').delete().eq('id', id);
    fetchData();
  };


  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-[98%] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">🏗️ 和芳工程行 薪資管理後台</h1>
          <div className="flex gap-3">
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">🚪 登出</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-300 mb-6">
          <button onClick={() => setActiveTab('attendance')} className={`px-6 py-3 font-bold text-lg ${activeTab === 'attendance' ? 'border-b-4 border-[#F1C40F] text-black' : 'text-gray-500'}`}>📅 出勤紀錄</button>
          <button onClick={() => setActiveTab('employees')} className={`px-6 py-3 font-bold text-lg ${activeTab === 'employees' ? 'border-b-4 border-[#F1C40F] text-black' : 'text-gray-500'}`}>👥 人員管理</button>
          <button onClick={() => setActiveTab('sites')} className={`px-6 py-3 font-bold text-lg ${activeTab === 'sites' ? 'border-b-4 border-[#F1C40F] text-black' : 'text-gray-500'}`}>🏗️ 工區管理 (Sites)</button>
        </div>

        {/* --- Tab Content: ATTENDANCE --- */}
        {activeTab === 'attendance' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-4 items-center bg-white p-3 rounded shadow">
                <span className="text-gray-900 font-extrabold mr-2 text-lg">月份 (Month):</span>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border-2 border-gray-300 p-1 rounded font-bold text-black" />
                <span className="text-gray-900 font-extrabold mr-2 ml-4 text-lg">員工 (Staff):</span>
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="border p-1 rounded bg-white w-32">
                  <option value="">All</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={openCreateModal} className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow">➕ 新增紀錄</button>
                <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow">📥 匯出</button>
                {selectedIds.size > 0 && <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded font-bold shadow">🗑️ 刪除 ({selectedIds.size})</button>}
              </div>
            </div>

            <div className="bg-white shadow-xl rounded-lg overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-16 py-4 pl-4 text-center font-black text-gray-900"><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} className="h-5 w-5" /></th>
                    <th className="px-3 py-3 text-left text-lg font-black text-gray-900">姓名</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-gray-800">日期</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-blue-800">In</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-blue-800">Out</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-gray-900">工區 (Area)</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-gray-500">工時</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-blue-600">薪資制度 (Rate)</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-red-600">預支</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-green-700">總計 (Total)</th>
                    <th className="px-3 py-3 text-left text-lg font-black text-gray-500">Act</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map(log => {
                    const p = log.profiles;
                    const isMonthly = p?.salary_type === 'monthly';
                    const wageDisplay = isMonthly
                      ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">月薪 ${p?.monthly_wage?.toLocaleString()}</span>
                      : <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">日薪 ${p?.daily_wage?.toLocaleString()}</span>;

                    const totalDisplay = isMonthly
                      ? <span className="text-gray-400 font-bold text-xs">✅ 月薪制</span>
                      : <span className="text-green-700 font-black">NT$ {calculateConstructionPay(log).toLocaleString()}</span>;

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
                        <td className="w-16 py-4 pl-4 text-center align-middle"><input type="checkbox" checked={selectedIds.has(log.id)} onChange={() => toggleSelect(log.id)} className="h-5 w-5 border-gray-300 rounded focus:ring-black" /></td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-extrabold text-gray-900">{p?.full_name || '未知'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 font-mono">{formatDate(log.check_in_time)}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-blue-900 font-mono">{formatTime(log.check_in_time)}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-blue-900 font-mono">{formatTime(log.check_out_time)}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 bg-yellow-50">{log.work_area || <span className="text-gray-400 font-normal italic">-</span>}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{calculateDisplayDuration(log.check_in_time, log.check_out_time, log.bonus_hours)}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{wageDisplay}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold font-mono">{log.cash_advance ? <span className="text-red-700 font-black">-${log.cash_advance}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-black text-green-700 tracking-wide bg-green-50">{totalDisplay}</td>
                        <td className="px-3 py-4 text-sm font-medium"><button onClick={() => openEditModal(log)} className="text-indigo-700 hover:text-indigo-900 font-bold border-2 border-indigo-200 hover:border-indigo-600 px-3 py-1 rounded transition-all">Edit</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* --- Tab Content: STAFF --- */}
        {activeTab === 'employees' && (
          <>
            {/* Header Row for Staff - Ensuring Button Visibility */}
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded shadow border border-indigo-100">
              <h2 className="text-2xl font-black text-gray-900">人員列表 (Staff List)</h2>
              <button onClick={openRegModal} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-black text-lg shadow-lg flex items-center gap-2 transform transition hover:scale-105">
                ➕ 新增員工 (Register)
              </button>
            </div>

            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-4 py-4 text-left text-lg font-black text-[#F1C40F] uppercase">姓名</th>
                    <th className="px-4 py-4 text-left text-lg font-black text-white uppercase">制度 (Type)</th>
                    <th className="px-4 py-4 text-left text-lg font-black text-green-400 uppercase">薪資 (Wage)</th>
                    <th className="px-4 py-4 text-left text-lg font-black text-blue-400 uppercase">預設工地</th>
                    <th className="px-4 py-4 text-left text-lg font-black text-gray-400 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profiles.map(p => {
                    const isMonthly = p.salary_type === 'monthly';
                    const site = workSites.find(s => s.id === p.default_site_id);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="px-6 py-4 whitespace-nowrap text-lg font-extrabold text-gray-900">{p.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">Employee</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-green-700">
                          ${(isMonthly ? p.monthly_wage : p.daily_wage)?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                          {site ? `📍 ${site.name}` : <span className="text-gray-400">Unbound</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button onClick={() => openEmpEditModal(p)} className="text-indigo-600 border-2 border-indigo-200 px-4 py-1 rounded-lg font-bold hover:bg-indigo-50 hover:text-indigo-800 transition-colors">設定 (Edit)</button>
                            <button onClick={() => handleDeleteEmployee(p.id, p.full_name)} className="text-red-600 border-2 border-red-200 px-4 py-1 rounded-lg font-bold hover:bg-red-50 hover:text-red-800 transition-colors">刪除 (Delete)</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* --- Tab Content: SITES --- */}
        {activeTab === 'sites' && (
          <>
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded shadow border border-indigo-100">
              <h2 className="text-2xl font-black text-gray-900">工區管理 (Site Management)</h2>
              <button onClick={() => openSiteModal()} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-black text-lg shadow-lg flex items-center gap-2 transform transition hover:scale-105">
                ➕ 新增工區 (Add Site)
              </button>
            </div>

            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-lg font-black text-[#F1C40F] uppercase">工區名稱 (Name)</th>
                    <th className="px-6 py-4 text-left text-lg font-black text-white uppercase">緯度 (Lat)</th>
                    <th className="px-6 py-4 text-left text-lg font-black text-white uppercase">經度 (Lng)</th>
                    <th className="px-6 py-4 text-left text-lg font-black text-blue-400 uppercase">範圍 (Radius)</th>
                    <th className="px-6 py-4 text-left text-lg font-black text-red-400 uppercase">操作 (Action)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workSites.map(site => (
                    <tr key={site.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap text-lg font-extrabold text-gray-900">{site.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-700">{site.latitude}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-700">{site.longitude}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-blue-800">{site.radius_meters || site.radius || 500}m</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-3">
                        <button onClick={() => openSiteModal(site)} className="text-blue-600 border-2 border-blue-200 px-4 py-1 rounded-lg font-bold hover:bg-blue-50 hover:text-blue-800 transition-colors">編輯 (Edit)</button>
                        <button onClick={() => handleDeleteSite(site.id)} className="text-red-600 border-2 border-red-200 px-4 py-1 rounded-lg font-bold hover:bg-red-50 hover:text-red-800 transition-colors">刪除 (Delete)</button>
                      </td>
                    </tr>
                  ))}
                  {workSites.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-bold">No sites configured.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* --- Modal: Attendance Record --- */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-80 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="relative p-8 border-2 border-gray-900 w-full max-w-lg shadow-2xl rounded-xl bg-white">
              <h3 className="text-2xl font-black text-black mb-6 text-center border-b-4 border-yellow-400 pb-2">
                {isCreateMode ? '➕ 新增施工紀錄' : '✏️ 編輯施工紀錄'}
              </h3>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-black text-sm font-black mb-1">員工姓名 Employee</label>
                    <select value={formUserId} onChange={(e) => setFormUserId(e.target.value)} className="w-full border-2 border-gray-400 rounded px-3 py-2 text-black font-bold bg-white focus:ring-2 focus:ring-black">
                      <option value="">請選擇...</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-black text-sm font-black mb-1">日期 Date</label>
                    <input type="datetime-local" value={formCheckIn} onChange={(e) => setFormCheckIn(e.target.value)} className="w-full border-2 border-gray-400 rounded px-2 py-2 text-sm font-mono text-black font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                  <div>
                    <label className="block text-black text-sm font-black mb-1">工區 (Work Area)</label>
                    <select value={formWorkArea} onChange={(e) => setFormWorkArea(e.target.value)} className="w-full border-2 border-gray-400 rounded px-3 py-2 text-black font-bold bg-white">
                      <option value="">-- 選擇工區 (Select Site) --</option>
                      {workSites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-red-700 text-sm font-black mb-1">預支 (Advance)</label>
                    <input type="number" value={formAdvance} onChange={(e) => setFormAdvance(parseFloat(e.target.value))} className="w-full border-2 border-red-500 rounded px-3 py-2 text-red-700 font-black bg-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-blue-900 text-sm font-black mb-1">上班 (Check In)</label>
                    <input type="datetime-local" value={formCheckIn} onChange={(e) => setFormCheckIn(e.target.value)} className="w-full border-2 border-blue-200 rounded px-2 py-2 text-sm font-mono text-blue-900 font-bold" />
                  </div>
                  <div>
                    <label className="block text-blue-900 text-sm font-black mb-1">下班 (Check Out)</label>
                    <input type="datetime-local" value={formCheckOut} onChange={(e) => setFormCheckOut(e.target.value)} className="w-full border-2 border-blue-200 rounded px-2 py-2 text-sm font-mono text-blue-900 font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-800 text-sm font-black mb-1">工時調整 (Bonus Hrs)</label>
                    <input type="number" step="0.5" value={formBonus} onChange={(e) => setFormBonus(parseFloat(e.target.value))} className="w-full border-2 border-gray-400 rounded px-3 py-2 font-mono text-black font-bold" />
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t-2 border-gray-200">
                  <button onClick={handleSaveRecord} className="flex-1 bg-black text-white py-3 rounded-lg font-black text-lg hover:bg-gray-800 shadow-lg transform active:scale-95 transition-all">儲存 (Save)</button>
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 text-black py-3 rounded-lg font-bold hover:bg-gray-300 border-2 border-gray-400">取消 (Cancel)</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Modal: Register Staff --- */}
        {isRegModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl w-full max-w-lg shadow-2xl border-4 border-gray-800">
              <h3 className="font-extrabold text-3xl mb-6 text-center text-gray-900 border-b-4 border-green-500 pb-4">
                ➕ 註冊新員工
              </h3>

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-gray-900 font-extrabold mb-1 text-lg">員工姓名 (Name)</label>
                  <input
                    type="text"
                    placeholder="例: 王小明"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    className="w-full bg-white text-gray-900 border-2 border-gray-300 focus:border-yellow-500 rounded-lg p-3 font-bold text-lg"
                  />
                </div>

                {/* Email & Password */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-900 font-extrabold mb-1">Email (帳號)</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full bg-white text-gray-900 border-2 border-gray-300 focus:border-yellow-500 rounded-lg p-3 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-900 font-extrabold mb-1">密碼 (Password)</label>
                    <input
                      type="text"
                      placeholder="min 6 chars"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      className="w-full bg-white text-gray-900 border-2 border-gray-300 focus:border-yellow-500 rounded-lg p-3 font-bold"
                    />
                  </div>
                </div>

                {/* Salary Section */}
                <div className="bg-gray-100 p-5 rounded-xl border-2 border-gray-200">
                  <label className="block font-extrabold text-gray-900 mb-3 text-lg">計薪方式 (Salary Type):</label>
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-900 text-lg">
                      <input
                        type="radio"
                        checked={regSalaryType === 'daily'}
                        onChange={() => setRegSalaryType('daily')}
                        className="w-6 h-6 text-green-600 focus:ring-green-500"
                      />
                      日薪 (Daily)
                    </label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-900 text-lg">
                      <input
                        type="radio"
                        checked={regSalaryType === 'monthly'}
                        onChange={() => setRegSalaryType('monthly')}
                        className="w-6 h-6 text-blue-600 focus:ring-blue-500"
                      />
                      月薪 (Monthly)
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-extrabold uppercase text-gray-700 mb-1">
                      {regSalaryType === 'daily' ? '每日薪資 (Daily Wage)' : '每月薪資 (Monthly Salary)'}
                    </label>
                    <input
                      type="number"
                      value={regWage}
                      onChange={e => setRegWage(Number(e.target.value))}
                      className={`w-full border-4 rounded-lg p-3 font-mono font-black text-2xl bg-white ${regSalaryType === 'daily' ? 'border-green-500 text-green-800' : 'border-blue-500 text-blue-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold uppercase text-gray-700 mb-1">預設工區 (Default Site)</label>
                    <select
                      value={regSiteId}
                      onChange={e => setRegSiteId(e.target.value)}
                      className="w-full bg-white text-gray-900 border-2 border-gray-300 focus:border-indigo-500 rounded-lg p-3 font-bold"
                    >
                      <option value="">🚫 未綁定 (Unbound)</option>
                      {workSites.map(s => <option key={s.id} value={s.id}>📍 {s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 mt-2">
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="flex-1 bg-green-700 text-white py-4 rounded-xl font-black text-xl hover:bg-green-800 shadow-xl transition-transform active:scale-95"
                  >
                    {isRegistering ? '處理中...' : '確認註冊 (Create)'}
                  </button>
                  <button
                    onClick={() => setIsRegModalOpen(false)}
                    className="flex-1 bg-gray-200 text-gray-900 py-4 rounded-xl font-bold text-lg hover:bg-gray-300 border-2 border-gray-400"
                  >
                    取消 (Cancel)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Modal: Edit Profile --- */}
        {isEmpModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-2xl border-4 border-gray-900">
              <h3 className="font-extrabold text-2xl mb-6 text-gray-900 border-b-4 border-indigo-200 pb-2">⚙️ 設定員工 (Edit Profile)</h3>
              <h2 className="text-3xl font-black mb-6 text-gray-900">{empFormName}</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-lg border-2 border-indigo-100">
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-500 mb-2">UPDATE CREDENTIALS (LEAVE BLANK TO KEEP)</p>
                  </div>
                  <div>
                    <label className="block font-black text-gray-900 mb-1">New Email</label>
                    <input type="email" placeholder="New Email" value={empFormEmail} onChange={e => setEmpFormEmail(e.target.value)} className="w-full border-2 border-gray-300 p-2 rounded text-black font-bold" />
                  </div>
                  <div>
                    <label className="block font-black text-gray-900 mb-1">New Password</label>
                    <input type="text" placeholder="New Password" value={empFormPassword} onChange={e => setEmpFormPassword(e.target.value)} className="w-full border-2 border-gray-300 p-2 rounded text-black font-bold" />
                  </div>
                </div>
                <div className="bg-gray-100 p-5 rounded-lg border-2 border-gray-300">
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 font-bold text-gray-900 text-lg cursor-pointer">
                      <input type="radio" checked={empFormSalaryType === 'daily'} onChange={() => setEmpFormSalaryType('daily')} className="w-5 h-5 text-green-600" />
                      日薪 (Daily)
                    </label>
                    <label className="flex items-center gap-2 font-bold text-gray-900 text-lg cursor-pointer">
                      <input type="radio" checked={empFormSalaryType === 'monthly'} onChange={() => setEmpFormSalaryType('monthly')} className="w-5 h-5 text-blue-600" />
                      月薪 (Monthly)
                    </label>
                  </div>
                  <label className="block font-extrabold text-gray-900 mb-2 text-lg">金額 (Amount)</label>
                  <input type="number" value={empFormWage} onChange={e => setEmpFormWage(Number(e.target.value))} className="w-full border-4 border-gray-400 focus:border-green-600 p-3 rounded font-mono font-black text-2xl text-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block font-extrabold text-gray-900 mb-2 text-lg">預設工區 (Site)</label>
                  <select value={empFormSiteId} onChange={e => setEmpFormSiteId(e.target.value)} className="w-full border-2 border-gray-400 p-3 rounded text-gray-900 font-bold bg-white text-lg">
                    <option value="">🚫 Unbound (未綁定)</option>
                    {workSites.map(s => <option key={s.id} value={s.id}>📍 {s.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={handleSaveEmployee} className="flex-1 bg-indigo-700 text-white py-4 rounded-lg font-black text-xl hover:bg-indigo-800 shadow-lg">Update</button>
                  <button onClick={() => setIsEmpModalOpen(false)} className="flex-1 bg-gray-200 text-gray-900 py-4 rounded-lg font-bold text-lg hover:bg-gray-300 border-2 border-gray-400">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Modal: Add Site --- */}
        {isSiteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl w-full max-w-lg shadow-2xl border-4 border-gray-900">
              <h3 className="font-extrabold text-2xl mb-6 text-gray-900 text-center border-b-4 border-yellow-400 pb-2">
                {editingSiteId ? '✏️ 編輯工區 (Edit Site)' : '➕ 新增工區 (Add Site)'}
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block font-extrabold text-gray-900 mb-1 text-lg">工區名稱 (Site Name)</label>
                  <input type="text" placeholder="例: 鳳山工地" value={siteName} onChange={e => setSiteName(e.target.value)} className="w-full border-2 border-gray-400 p-3 rounded font-bold text-gray-900 bg-white text-lg focus:border-yellow-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-extrabold text-gray-900 mb-1">緯度 (Latitude)</label>
                    <input type="number" step="any" value={siteLat} onChange={e => setSiteLat(parseFloat(e.target.value))} className="w-full border-2 border-gray-400 p-3 rounded font-mono font-bold text-gray-900 bg-white" />
                  </div>
                  <div>
                    <label className="block font-extrabold text-gray-900 mb-1">經度 (Longitude)</label>
                    <input type="number" step="any" value={siteLng} onChange={e => setSiteLng(parseFloat(e.target.value))} className="w-full border-2 border-gray-400 p-3 rounded font-mono font-bold text-gray-900 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block font-extrabold text-gray-900 mb-1 text-lg">範圍 Radius (meters)</label>
                  <input type="number" value={siteRadius} onChange={e => setSiteRadius(Number(e.target.value))} className="w-full border-2 border-gray-400 p-3 rounded font-mono font-bold text-gray-900 bg-white text-lg" />
                </div>

                <div className="flex gap-4 pt-4 mt-2">
                  <button onClick={handleSaveSite} className="flex-1 bg-green-700 text-white py-4 rounded-lg font-black text-xl hover:bg-green-800 shadow-xl">
                    {editingSiteId ? '更新 (Update)' : '建立 (Create)'}
                  </button>
                  <button onClick={() => setIsSiteModalOpen(false)} className="flex-1 bg-gray-200 text-gray-900 py-4 rounded-lg font-bold text-lg hover:bg-gray-300 border-2 border-gray-400">取消 (Cancel)</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}