'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';

import {
    Plus, Trash2, ChevronDown, ChevronUp, Save,
    CheckCircle2, Circle, Wallet, ArrowDownCircle,
    TrendingDown, TrendingUp, LayoutList, Calendar,
    ChevronLeft, ChevronRight, Copy, CheckSquare, X
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { saveFullTemplate, updateItemCheckStatus, cloneBudget, getBudgetsForMonth, getTemplates, deleteTemplate, login, register } from '@/lib/actions';
import { User, LogOut, UserPlus, Key, RefreshCw, GripVertical } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Item {
    id?: string;
    name: string;
    amount: number;
    isChecked: boolean;
}

interface Category {
    id: string; // Force stable unique ID
    name: string;
    items: Item[];
    isExpanded: boolean;
}

interface Income {
    id?: string;
    name: string;
    amount: number;
}

interface BudgetAppProps {
    initialTemplates?: any[];
    user?: { id: string, username: string, fullname: string } | null;
    logoutAction?: () => Promise<void>;
}

// Subcomponent for drag-and-drop sorting via framer-motion
function CategoryCard({
    cat, catIdx, categories, setCategories, handleItemChange,
    handleRemoveItem, handleAmountInput, handleAddItem, formatNumber
}: {
    cat: Category; catIdx: number; categories: Category[]; setCategories: any;
    handleItemChange: any; handleRemoveItem: any; handleAmountInput: any; handleAddItem: any; formatNumber: any;
}) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={cat.id}
            dragListener={false}
            dragControls={controls}
            className="glass-card overflow-hidden select-none"
        >
            <div className="flex items-center gap-2">
                <div
                    className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none py-2"
                    onPointerDown={(e) => controls.start(e)}
                >
                    <GripVertical size={18} />
                </div>
                <button onClick={() => {
                    const n = [...categories]; n[catIdx].isExpanded = !n[catIdx].isExpanded; setCategories(n);
                }} className="text-primary shrink-0">{cat.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                <input
                    className="bg-transparent text-sm font-black text-white outline-none flex-1 border-white/5 uppercase tracking-wide"
                    value={cat.name}
                    onChange={(e) => { const n = [...categories]; n[catIdx].name = e.target.value; setCategories(n); }}
                />
                <button onClick={() => setCategories(categories.filter((_: any, i: number) => i !== catIdx))} className="text-red-400/30 hover:text-red-400 shrink-0"><Trash2 size={16} /></button>
            </div>
            <AnimatePresence initial={false}>
                {cat.isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-2 pt-4">
                            {cat.items.map((item: any, itemIdx: number) => (
                                <div key={itemIdx} className="space-y-2 pb-2 border-b border-white/5 last:border-b-0 last:pb-0">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="input-field flex-1 text-sm font-black py-3"
                                            placeholder="Nama Item (e.g. Bebelove)"
                                            value={item.name}
                                            onChange={(e) => handleItemChange(catIdx, itemIdx, 'name', e.target.value)}
                                        />
                                        <button onClick={() => handleRemoveItem(catIdx, itemIdx)} className="text-red-400/50 hover:text-red-400 transition-all p-2"><Trash2 size={18} /></button>
                                    </div>
                                    <input
                                        className="input-field w-full text-base font-bold py-3 text-secondary"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={formatNumber(item.amount)}
                                        onChange={(e) => handleAmountInput(e.target.value, (n: number) => handleItemChange(catIdx, itemIdx, 'amount', n))}
                                    />
                                </div>
                            ))}
                            <button onClick={() => handleAddItem(catIdx)} className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/5 hover:border-white/20 transition-all">+ TAMBAH ITEM</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Reorder.Item>
    );
}

export default function BudgetApp({ initialTemplates = [], user, logoutAction }: BudgetAppProps) {
    const [mode, setMode] = useState<'edit' | 'checklist' | 'templates'>('edit');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [incomes, setIncomes] = useState<Income[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    }, []);

    const monthKey = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }, [currentDate]);

    const monthLabel = useMemo(() => {
        return currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }, [currentDate]);

    const [monthlyBudgetName, setMonthlyBudgetName] = useState('');
    const [masterTemplates, setMasterTemplates] = useState<any[]>(initialTemplates);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [monthlyBudgets, setMonthlyBudgets] = useState<any[]>([]);
    const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
    const [showSubBudgetModal, setShowSubBudgetModal] = useState(false);
    const [newSubBudgetName, setNewSubBudgetName] = useState('');

    // Storage key scoped per user — prevents data leakage between accounts
    const storageKey = useMemo(() => {
        if (!user) return null;
        return activeBudgetId ? `budget_${user.id}_${activeBudgetId}` : `budget_${user.id}_${monthKey}_new`;
    }, [user, monthKey, activeBudgetId]);
    const syncQueueKey = user ? `sync_queue_${user.id}` : null;

    // Offline Sync & Local Storage — only persist if user is authenticated
    useEffect(() => {
        if (!storageKey) return;
        const savedData = localStorage.getItem(storageKey);
        if (savedData && incomes.length === 0 && categories.length === 0) {
            const parsed = JSON.parse(savedData);
            setIncomes(parsed.incomes || []);
            setCategories(parsed.categories?.map((c: any) => ({ ...c, id: c.id || crypto.randomUUID() })) || []);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        if (incomes.length > 0 || categories.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify({ incomes, categories }));
        }
    }, [incomes, categories, storageKey]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            if (!syncQueueKey) return;
            const queue = localStorage.getItem(syncQueueKey);
            if (queue) {
                const pending = JSON.parse(queue);
                if (pending.length > 0) {
                    alert('Anda kembali online! Mensinkronisasi data...');
                    handleSaveMonth();
                    localStorage.removeItem(syncQueueKey);
                }
            }
        };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [incomes, categories]);

    const loadMonthData = async (key: string) => {
        setLoading(true);
        try {
            const budgets = await getBudgetsForMonth(key);
            if (budgets && budgets.length > 0) {
                setMonthlyBudgets(budgets);

                // Keep current active tab if it exists in new fetch, otherwise select first ('main' is usually first because of orderBy createdAt)
                let targetBudget = budgets.find(b => b.id === activeBudgetId);
                if (!targetBudget) {
                    targetBudget = budgets[0];
                    setActiveBudgetId(targetBudget.id);
                }

                setMonthlyBudgetName(targetBudget.name);
                const serverIncomes = targetBudget.incomes.map((i: any) => ({ id: i.id, name: i.name, amount: Number(i.amount) }));
                const serverCategories = targetBudget.expenseCategories.map((c: any) => ({
                    id: c.id || crypto.randomUUID(),
                    name: c.name,
                    isExpanded: false,
                    items: c.expenseItems.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        amount: Number(item.amount),
                        isChecked: item.isChecked
                    }))
                }));
                setIncomes(serverIncomes);
                setCategories(serverCategories);

                // Sync local cache
                const activeStorageKey = `budget_${user?.id}_${targetBudget.id}`;
                if (user) {
                    localStorage.setItem(activeStorageKey, JSON.stringify({ incomes: serverIncomes, categories: serverCategories }));
                }
            } else {
                setMonthlyBudgets([]);
                setActiveBudgetId(null);
                setMonthlyBudgetName('');
                setIncomes([]);
                setCategories([]);
                if (storageKey) localStorage.removeItem(storageKey);
            }
        } catch (e) {
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const refreshTemplates = async () => {
        const fresh = await getTemplates();
        setMasterTemplates(JSON.parse(JSON.stringify(fresh)));
    };

    useEffect(() => {
        loadMonthData(monthKey);
    }, [monthKey]);

    const totalIncome = useMemo(() => incomes.reduce((acc, curr) => acc + curr.amount, 0), [incomes]);

    // Number formatting helpers
    const formatNumber = (val: number): string => {
        if (!val && val !== 0) return '';
        return val === 0 ? '' : val.toLocaleString('id-ID');
    };
    const parseNumber = (str: string): number => {
        const cleaned = str.replace(/\./g, '').replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : 0;
    };
    const handleAmountInput = (raw: string, setter: (n: number) => void) => {
        setter(parseNumber(raw));
    };
    const totalExpense = useMemo(() => {
        return categories.reduce((acc, cat) => {
            return acc + cat.items.reduce((iAcc, item) => iAcc + item.amount, 0);
        }, 0);
    }, [categories]);

    const totalCheckedExpense = useMemo(() => {
        return categories.reduce((acc, cat) => {
            return acc + cat.items.filter(i => i.isChecked).reduce((iAcc, item) => iAcc + item.amount, 0);
        }, 0);
    }, [categories]);

    const balance = totalIncome - totalExpense;
    const currentBudget = totalIncome - totalCheckedExpense;

    const handlePrevMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };

    const handleNextMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    const handleAddIncome = () => {
        setIncomes([...incomes, { name: '', amount: 0 }]);
    };

    const handleRemoveIncome = (index: number) => {
        setIncomes(incomes.filter((_, i) => i !== index));
    };

    const handleIncomeChange = (index: number, field: keyof Income, value: string | number) => {
        const newIncomes = [...incomes];
        if (field === 'amount') {
            newIncomes[index].amount = Number(value);
        } else {
            newIncomes[index].name = value as string;
        }
        setIncomes(newIncomes);
    };

    const handleAddItem = (catIndex: number) => {
        const newCategories = [...categories];
        newCategories[catIndex].items.push({ name: '', amount: 0, isChecked: false });
        setCategories(newCategories);
    };

    const handleRemoveItem = (catIndex: number, itemIndex: number) => {
        const newCategories = [...categories];
        newCategories[catIndex].items = newCategories[catIndex].items.filter((_, i) => i !== itemIndex);
        setCategories(newCategories);
    };

    const handleItemChange = (catIndex: number, itemIndex: number, field: keyof Item, value: any) => {
        const newCategories = [...categories];
        (newCategories[catIndex].items[itemIndex] as any)[field] = value;
        setCategories(newCategories);
        if (mode === 'checklist' && field === 'isChecked' && newCategories[catIndex].items[itemIndex].id) {
            updateItemCheckStatus(newCategories[catIndex].items[itemIndex].id!, value);
        }
    };

    const toggleCheckAll = (catIndex: number) => {
        const newCategories = [...categories];
        const category = newCategories[catIndex];
        const allChecked = category.items.every(i => i.isChecked);
        category.items.forEach(item => {
            item.isChecked = !allChecked;
            if (item.id) updateItemCheckStatus(item.id, !allChecked);
        });
        setCategories(newCategories);
    };

    const handleSaveMonth = async () => {
        if (!navigator.onLine) {
            if (syncQueueKey) localStorage.setItem(syncQueueKey, JSON.stringify([{ type: 'saveMonth', date: new Date().toISOString() }]));
            alert('Offline: Perubahan disimpan di perangkat dan akan disinkronkan saat online.');
            return;
        }
        setLoading(true);
        try {
            const isFirstBudget = monthlyBudgets.length === 0;
            const newType = isFirstBudget ? 'main' : 'sub';
            const defaultName = isFirstBudget ? `Perencanaan` : `Sub Anggaran`;

            await saveFullTemplate({
                id: activeBudgetId || undefined,
                name: monthlyBudgetName || defaultName,
                targetMonth: monthKey,
                isTemplate: false,
                type: activeBudgetId ? undefined : newType,
                incomes,
                categories: categories.map(c => ({
                    name: c.name,
                    items: c.items.map(i => ({ name: i.name, amount: i.amount, isChecked: i.isChecked }))
                }))
            });
            alert('Berhasil disimpan!');
            loadMonthData(monthKey);
        } catch (e) {
            alert('Gagal menyimpan');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName) return;
        setLoading(true);
        try {
            await saveFullTemplate({
                name: newTemplateName,
                isTemplate: true,
                incomes,
                categories: categories.map(c => ({
                    name: c.name,
                    items: c.items.map(i => ({ name: i.name, amount: i.amount, isChecked: false }))
                }))
            });
            alert('Template Master disimpan!');
            setNewTemplateName('');
            setShowTemplateModal(false);
            refreshTemplates();
        } catch (e) {
            alert('Gagal menyimpan template');
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async (templateId: string) => {
        setLoading(true);
        try {
            await cloneBudget(templateId, monthKey, `Anggaran ${monthLabel}`);
            alert('Template berhasil diterapkan!');
            loadMonthData(monthKey);
            setMode('edit');
        } catch (e) {
            alert('Gagal menerapkan template');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Hapus template ini?')) return;
        setLoading(true);
        try {
            await deleteTemplate(templateId);
            alert('Template dihapus!');
            refreshTemplates();
        } catch (e) {
            alert('Gagal menghapus template');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSubBudget = async (id: string, name: string) => {
        if (!confirm(`Hapus anggaran "${name}"? Data di dalamnya akan hilang.`)) return;
        setLoading(true);
        try {
            await deleteTemplate(id); // deleteTemplate works for any budget id
            alert('Berhasil dihapus!');
            // Re-load the month, this will automatically select the first tab ('Perencanaan')
            setActiveBudgetId(null);
            loadMonthData(monthKey);
        } catch (e) {
            alert('Gagal menghapus anggaran');
        } finally {
            setLoading(false);
        }
    };

    const formatIDR = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    };

    if (!user) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card w-full max-w-md space-y-8 p-8"
                >
                    <div className="text-center space-y-2">
                        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-xl shadow-primary/10">
                            <Wallet className="text-primary" size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">WANGKIT</h2>
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Catatan Keuangan Bulanan</p>
                    </div>

                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setError(null);
                            setLoading(true);
                            try {
                                const formData = new FormData(e.currentTarget);
                                await (authMode === 'login' ? login(formData) : register(formData));
                            } catch (err: any) {
                                setError(err.message);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="space-y-6"
                    >
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest p-4 rounded-xl text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            {authMode === 'register' && (
                                <div className="space-y-2.5 group">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 group-focus-within:text-primary transition-colors">Nama Lengkap</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                                            <User size={18} />
                                        </div>
                                        <input
                                            name="fullname"
                                            required
                                            className="input-field w-full py-4 font-bold !pl-12 focus:ring-2 focus:ring-primary/10 transition-all"
                                            placeholder="Budi Santoso"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2.5 group">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 group-focus-within:text-primary transition-colors">Username</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <UserPlus size={18} />
                                    </div>
                                    <input
                                        name="username"
                                        required
                                        className="input-field w-full py-4 font-bold !pl-12 focus:ring-2 focus:ring-primary/10 transition-all"
                                        placeholder="budis123"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2.5 group">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 group-focus-within:text-primary transition-colors">Password</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <Key size={18} />
                                    </div>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="input-field w-full py-4 font-bold !pl-12 focus:ring-2 focus:ring-primary/10 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-5 text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/20 mt-4 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
                            ) : (
                                <>
                                    {authMode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun'}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center pt-6 border-t border-white/5">
                        <button
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setError(null);
                            }}
                            className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline hover:opacity-80 transition-all"
                        >
                            {authMode === 'login' ? 'Belum punya akun? Daftar Gratis' : 'Sudah punya akun? Masuk Sini'}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header User */}
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                        <User className="text-primary" size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Selamat Datang,</p>
                            {isOffline && (
                                <span className="bg-amber-500/20 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">Offline</span>
                            )}
                        </div>
                        <p className="text-sm font-bold text-white tracking-tight">{user.fullname}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadMonthData(monthKey)}
                        disabled={loading}
                        title="Refresh data"
                        className="p-3 bg-white/5 text-muted-foreground rounded-xl hover:bg-white/10 hover:text-primary transition-all border border-white/5 disabled:opacity-40"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => logoutAction?.()}
                        className="p-3 bg-white/5 text-muted-foreground rounded-xl hover:bg-white/10 hover:text-red-400 transition-all border border-white/5"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
            {/* Month Navigation */}
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10 glass shadow-sm">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-xl transition-all text-primary"><ChevronLeft /></button>
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Calendar className="text-primary" size={16} />
                    {monthLabel}
                </div>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-xl transition-all text-primary"><ChevronRight /></button>
            </div>

            {/* Sub-Budget Tabs */}
            {mode !== 'templates' && (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar items-center">
                    {monthlyBudgets.map((b, idx) => (
                        <div key={b.id} className="relative flex items-center shrink-0">
                            <button
                                onClick={() => {
                                    setActiveBudgetId(b.id);
                                    const serverIncomes = b.incomes.map((i: any) => ({ ...i, amount: Number(i.amount) }));
                                    const serverCategories = b.expenseCategories.map((c: any) => ({
                                        ...c,
                                        isExpanded: false,
                                        items: c.expenseItems.map((item: any) => ({ ...item, amount: Number(item.amount) }))
                                    }));
                                    setIncomes(serverIncomes);
                                    setCategories(serverCategories);
                                    setMonthlyBudgetName(b.name);
                                }}
                                className={cn("whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all border flex items-center gap-2",
                                    activeBudgetId === b.id
                                        ? "bg-secondary text-white border-secondary shadow-lg shadow-secondary/20"
                                        : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10")}
                            >
                                {b.name}
                            </button>
                            {/* Only show delete button for the active tab, and only if it's NOT the very first (main) budget */}
                            {activeBudgetId === b.id && idx !== 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSubBudget(b.id, b.name);
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md active:scale-90"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => setShowSubBudgetModal(true)}
                        className="whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all border bg-white/5 border-dashed border-white/20 text-primary hover:bg-white/10"
                    >
                        + SUB
                    </button>
                </div>
            )}

            {/* Header Stats */}
            <motion.div
                layout
                className="glass-card bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/20 relative overflow-hidden"
            >
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-sm font-black flex items-center gap-2 text-white uppercase tracking-tighter">
                        <Wallet className="text-primary" size={18} /> {mode === 'checklist' ? 'Eksekusi' : (monthlyBudgetName || 'Perencanaan')}
                    </h1>
                    <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", balance >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                        Sisa: {formatIDR(balance)}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-black">Pemasukan</p>
                        <p className="text-lg font-bold text-white">{formatIDR(totalIncome)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-black">
                            {mode === 'checklist' ? 'Dipakai' : 'Pengeluaran'}
                        </p>
                        <p className="text-lg font-bold text-primary">
                            {formatIDR(mode === 'checklist' ? totalCheckedExpense : totalExpense)}
                        </p>
                    </div>
                </div>

                {mode === 'checklist' && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Pemanfaatan Dana:</p>
                            <p className={cn("text-xl font-black", currentBudget >= 0 ? "text-green-400" : "text-red-400")}>
                                {Math.round(Math.min(100, (totalCheckedExpense / totalIncome) * 100))}%
                            </p>
                        </div>
                        <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/10 shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (totalCheckedExpense / totalIncome) * 100)}%` }}
                                className="bg-gradient-to-r from-emerald-400 via-primary to-secondary h-full relative"
                            >
                                <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
                                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_#fff]" />
                            </motion.div>
                        </div>
                        <div className="flex justify-between mt-2">
                            <p className="text-[10px] font-black text-muted-foreground uppercase">{formatIDR(totalCheckedExpense)}</p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase">{formatIDR(totalIncome)}</p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Mode Switches */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {[
                    { id: 'edit', label: 'EDIT', icon: LayoutList },
                    { id: 'checklist', label: 'CEKLIS', icon: CheckCircle2 },
                    { id: 'templates', label: 'TEMPLATE', icon: Copy },
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id as any)}
                        className={cn("whitespace-nowrap flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all border",
                            mode === m.id
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10")}
                    >
                        <m.icon size={14} /> {m.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-muted-foreground">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        Memuat data...
                    </motion.div>
                ) : incomes.length === 0 && categories.length === 0 && mode !== 'templates' ? (
                    <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card text-center py-12 space-y-6">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                            <Calendar size={32} className="text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Anggaran {monthLabel} Kosong</h3>
                            <p className="text-[10px] uppercase font-black text-muted-foreground mt-2 tracking-widest">Gunakan template atau buat data baru</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mx-auto max-w-[200px]">
                            <button onClick={() => setMode('templates')} className="btn-secondary w-full text-[10px] font-black tracking-widest">GUNAKAN TEMPLATE</button>
                            <button onClick={() => {
                                setMonthlyBudgetName('Perencanaan');
                                setActiveBudgetId(null);
                                setIncomes([{ name: 'Gaji', amount: 0 }]);
                                setCategories([{ id: crypto.randomUUID(), name: 'Umum', isExpanded: false, items: [] }]);
                                setMode('edit');
                            }} className="btn-primary w-full text-[10px] font-black tracking-widest">BUAT BARU</button>
                        </div>
                    </motion.div>
                ) : mode === 'edit' && (
                    <motion.div key="edit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-32">
                        <section className="glass-card space-y-4">
                            <div className="flex justify-between items-center pb-2">
                                <h2 className="text-xs font-black flex items-center gap-2 uppercase tracking-widest"><ArrowDownCircle className="text-green-400" size={16} /> Pemasukan</h2>
                                <button onClick={handleAddIncome} className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"><Plus size={16} /></button>
                            </div>
                            <div className="space-y-2">
                                {incomes.map((inc, i) => (
                                    <div key={i} className="space-y-2 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                                        <div className="flex gap-2 items-center">
                                            <input
                                                className="input-field flex-1 text-sm font-black py-3"
                                                placeholder="Nama Pemasukan (e.g. Gaji Suami)"
                                                value={inc.name}
                                                onChange={(e) => handleIncomeChange(i, 'name', e.target.value)}
                                            />
                                            <button onClick={() => handleRemoveIncome(i)} className="text-red-400/50 hover:text-red-400 transition-all p-2"><Trash2 size={18} /></button>
                                        </div>
                                        <input
                                            className="input-field w-full text-base font-bold py-3 text-primary"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={formatNumber(inc.amount)}
                                            onChange={(e) => handleAmountInput(e.target.value, (n) => handleIncomeChange(i, 'amount', n))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h2 className="text-xs font-black flex items-center gap-2 uppercase tracking-widest"><TrendingDown className="text-red-400" size={16} /> Pengeluaran</h2>
                                <button onClick={() => setCategories([...categories, { id: crypto.randomUUID(), name: 'Kategori Baru', isExpanded: false, items: [] }])} className="btn-secondary text-[10px] font-black tracking-widest px-3 py-1.5">+ KATEGORI</button>
                            </div>
                            <Reorder.Group
                                axis="y"
                                values={categories.map(c => c.id)}
                                onReorder={(newIds: string[]) => {
                                    const sorted = newIds.map((id: string) => categories.find(c => c.id === id)!).filter(Boolean);
                                    setCategories(sorted);
                                }}
                                className="space-y-4"
                            >
                                {categories.map((cat, catIdx) => (
                                    <CategoryCard
                                        key={cat.id}
                                        cat={cat}
                                        catIdx={catIdx}
                                        categories={categories}
                                        setCategories={setCategories}
                                        handleItemChange={handleItemChange}
                                        handleRemoveItem={handleRemoveItem}
                                        handleAmountInput={handleAmountInput}
                                        handleAddItem={handleAddItem}
                                        formatNumber={formatNumber}
                                    />
                                ))}
                            </Reorder.Group>
                        </section>

                        <div className="fixed bottom-0 left-0 right-0 px-6 py-6 bg-slate-950 border-t border-white/10 z-50">
                            <div className="flex gap-3 max-w-sm mx-auto">
                                <button onClick={handleSaveMonth} className="btn-primary flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-3 shadow-lg">
                                    <Save size={16} /> SIMPAN
                                </button>
                                <button onClick={() => setShowTemplateModal(true)} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-3 shadow-lg">
                                    <Copy size={16} /> SIMPAN TEMPLATE
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {mode === 'checklist' && (
                    <motion.div key="checklist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        {categories.map((cat, catIdx) => (
                            <div key={catIdx} className="glass-card">
                                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                                    <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">{cat.name}</h3>
                                    <button
                                        onClick={() => toggleCheckAll(catIdx)}
                                        className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-primary/20 transition-all"
                                    >
                                        <CheckSquare size={14} /> Cek Semua
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {cat.items.map((item, itemIdx) => (
                                        <div
                                            key={itemIdx}
                                            onClick={() => handleItemChange(catIdx, itemIdx, 'isChecked', !item.isChecked)}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                                                item.isChecked
                                                    ? "bg-green-500/10 border-green-500/20 text-green-400 opacity-60"
                                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all", item.isChecked ? "bg-green-500 border-green-500" : "border-white/10 bg-black/20")}>
                                                    {item.isChecked && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 size={16} className="text-black" /></motion.div>}
                                                </div>
                                                <div>
                                                    <p className={cn("text-sm font-bold", item.isChecked && "line-through opacity-50")}>{item.name}</p>
                                                    <p className="text-[10px] uppercase font-black opacity-40">{formatIDR(item.amount)}</p>
                                                </div>
                                            </div>
                                            <p className="font-black text-sm">{formatIDR(item.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {mode === 'templates' && (
                    <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-between items-center px-1">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Master Templates</h2>
                        </div>
                        {masterTemplates.length === 0 ? (
                            <div className="glass-card text-center py-16 text-muted-foreground">
                                <Copy size={32} className="mx-auto mb-4 opacity-20" />
                                <p className="text-xs uppercase font-black tracking-widest">Belum ada template master</p>
                                <p className="text-[10px] mt-2 opacity-50">Simpan dari tab 'EDIT'</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {masterTemplates.map((t: any) => (
                                    <div key={t.id} className="glass-card flex justify-between items-center group border-white/5 shadow-lg">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">{t.name}</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{t.expenseCategories.length} Kat • {t.incomes.length} Sum</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleDeleteTemplate(t.id)} className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                            <button onClick={() => handleClone(t.id)} className="px-5 py-2.5 bg-primary text-primary-foreground font-black text-[10px] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20">
                                                GUNAKAN
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Template Name Modal */}
            <AnimatePresence>
                {showTemplateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 glass">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900 border border-white/20 p-6 rounded-3xl w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black uppercase text-white">Nama Template Master</h3>
                                <button onClick={() => setShowTemplateModal(false)} className="text-muted-foreground"><X size={20} /></button>
                            </div>
                            <input
                                autoFocus
                                className="input-field w-full mb-6 font-bold"
                                placeholder="Contoh: Rencana Bulanan Ideal"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowTemplateModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-muted-foreground hover:bg-white/5 rounded-xl">Batal</button>
                                <button onClick={handleSaveTemplate} className="flex-1 btn-primary py-3 text-[10px] font-black uppercase">Simpan</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sub-Budget Name Modal */}
            <AnimatePresence>
                {showSubBudgetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 glass">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900 border border-white/20 p-6 rounded-3xl w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black uppercase text-white">Buat Sub-Anggaran</h3>
                                <button onClick={() => setShowSubBudgetModal(false)} className="text-muted-foreground"><X size={20} /></button>
                            </div>
                            <input
                                autoFocus
                                className="input-field w-full mb-6 font-bold"
                                placeholder="Nama (Contoh: Liburan)"
                                value={newSubBudgetName}
                                onChange={(e) => setNewSubBudgetName(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowSubBudgetModal(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-muted-foreground hover:bg-white/5 rounded-xl">Batal</button>
                                <button onClick={() => {
                                    if (newSubBudgetName.trim()) {
                                        setMonthlyBudgetName(newSubBudgetName);
                                        setActiveBudgetId(null); // Null ID triggers creation on save
                                        setIncomes([{ name: 'Sisa Dana/Alokasi', amount: 0 }]);
                                        setCategories([{ id: crypto.randomUUID(), name: 'Pengeluaran', isExpanded: false, items: [] }]);
                                        setShowSubBudgetModal(false);
                                        setNewSubBudgetName('');
                                        setMode('edit');
                                    }
                                }} className="flex-1 btn-primary py-3 text-[10px] font-black uppercase">Buat</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
