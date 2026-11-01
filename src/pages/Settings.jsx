import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  RefreshCw,
  Info,
  Coins,
  Gift,
  Gamepad2,
  ListChecks,
  Tv,
  CalendarCheck,
  AlertTriangle,
  Wrench,
  Users as UsersIcon,
  HelpCircle,
  BarChart2,
  Sparkles,
  ArrowRightLeft,
  Wallet,
} from 'lucide-react';
import { db } from '../firebase/config.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Settings() {
  const [saving, setSaving] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(null);
  const [coinsPer100Inr, setCoinsPer100Inr] = useState(null);
  const [coinsPerUsd, setCoinsPerUsd] = useState(null);
  const [minWithdrawalInr, setMinWithdrawalInr] = useState(null);
  const [minWithdrawalUsd, setMinWithdrawalUsd] = useState(null);
  const queryClient = useQueryClient();

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['appConfig'],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'AppConfig', 'main'));
      return snap.exists() ? snap.data() : {};
    },
  });

  const c = config || {};
  const isMaintenance = maintenanceEnabled !== null ? maintenanceEnabled : (c.isMaintenanceMode ?? false);

  // Active Coin Valuation & Minimum Withdrawal States
  const activeCoinsPer100Inr = coinsPer100Inr !== null
    ? coinsPer100Inr
    : (c.coinsPer100Inr || (c.defaultInrPer1000 ? Math.round(100000 / c.defaultInrPer1000) : 20000));

  const activeCoinsPerUsd = coinsPerUsd !== null
    ? coinsPerUsd
    : (c.coinsPerUsd || (c.defaultUsdPer1000 ? Math.round(1000 / c.defaultUsdPer1000) : 20000));

  const activeMinWithdrawalInr = minWithdrawalInr !== null
    ? minWithdrawalInr
    : (c.minWithdrawalInr ?? (c.minWithdrawalPoints ? Number(((c.minWithdrawalPoints / (c.coinsPer100Inr || (c.defaultInrPer1000 ? 100000 / c.defaultInrPer1000 : 20000))) * 100).toFixed(1)) : 50));

  const activeMinWithdrawalUsd = minWithdrawalUsd !== null
    ? minWithdrawalUsd
    : (c.minWithdrawalUsd ?? (c.minWithdrawalPoints ? Number((c.minWithdrawalPoints / (c.coinsPerUsd || (c.defaultUsdPer1000 ? 1000 / c.defaultUsdPer1000 : 20000))).toFixed(2)) : 1));

  // Calculated coins needed for withdrawal
  const inrCoinsNeeded = Math.round((activeMinWithdrawalInr / 100) * activeCoinsPer100Inr);
  const usdCoinsNeeded = Math.round(activeMinWithdrawalUsd * activeCoinsPerUsd);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);

      // Parse daily check-in rewards: check day1..day7 fields first, then fallback to comma-separated
      let dailyCheckInRewards = [];
      const d1 = parseInt(fd.get('checkInDay1'));
      if (!isNaN(d1)) {
        dailyCheckInRewards = [
          d1,
          parseInt(fd.get('checkInDay2') || '10'),
          parseInt(fd.get('checkInDay3') || '15'),
          parseInt(fd.get('checkInDay4') || '20'),
          parseInt(fd.get('checkInDay5') || '25'),
          parseInt(fd.get('checkInDay6') || '30'),
          parseInt(fd.get('checkInDay7') || '50'),
        ];
      } else {
        const checkInRaw = fd.get('dailyCheckInRewards') || '5,10,15,20,25,30,50';
        dailyCheckInRewards = checkInRaw.split(',').map((v) => parseInt(v.trim())).filter((n) => !isNaN(n));
      }

      // Referral reward per 1 referral
      const refCoins = parseInt(fd.get('referralReward') || fd.get('referralCoins') || fd.get('referralMinReward') || '50');

      // Parse spin prizes (comma-separated)
      const spinRaw = fd.get('spinPrizes') || '10,20,50,5,40,0,25,15';
      const spinPrizes = spinRaw.split(',').map((v) => parseInt(v.trim())).filter((n) => !isNaN(n));

      // Parse spin weights (comma-separated)
      const weightsRaw = fd.get('spinWeights') || '20,15,8,25,4,20,12,18';
      const spinWeights = weightsRaw.split(',').map((v) => parseInt(v.trim())).filter((n) => !isNaN(n));

      const data = {
        // ── Maintenance Mode ──
        isMaintenanceMode: isMaintenance,
        maintenanceMessage: fd.get('maintenanceMessage')?.toString().trim() || 'Spin5X is undergoing scheduled maintenance. Please check back shortly!',

        // ── Min & Max Random Coin Rewards ──
        dailyCheckInRewards,
        dailyCheckInMinReward: dailyCheckInRewards[0] || 10,
        dailyCheckInMaxReward: dailyCheckInRewards[dailyCheckInRewards.length - 1] || 50,

        watchAdMinReward: parseInt(fd.get('watchAdMinReward') || '10'),
        watchAdMaxReward: parseInt(fd.get('watchAdMaxReward') || '50'),

        quizMinReward: parseInt(fd.get('quizMinReward') || '20'),
        quizMaxReward: parseInt(fd.get('quizMaxReward') || '60'),

        surveyMinReward: parseInt(fd.get('surveyMinReward') || '15'),
        surveyMaxReward: parseInt(fd.get('surveyMaxReward') || '45'),

        mysteryBoxMinReward: parseInt(fd.get('mysteryBoxMinReward') || '15'),
        mysteryBoxMaxReward: parseInt(fd.get('mysteryBoxMaxReward') || '40'),

        scratchMinReward: parseInt(fd.get('scratchMinReward') || '5'),
        scratchMaxReward: parseInt(fd.get('scratchMaxReward') || '50'),
        maxDailyScratches: parseInt(fd.get('maxDailyScratches') || '3'),

        referralReward: refCoins,
        referralCoins: refCoins,
        referralMinReward: refCoins,
        referralMaxReward: refCoins,

        gameMinReward: parseInt(fd.get('gameMinReward') || '5'),
        gameMaxReward: parseInt(fd.get('gameMaxReward') || '20'),

        // ── Coin value / conversion (100 Rs = X coins, 1 USD = Y coins) ──
        coinsPer100Inr: activeCoinsPer100Inr,
        coinsPerUsd: activeCoinsPerUsd,
        minWithdrawalInr: activeMinWithdrawalInr,
        minWithdrawalUsd: activeMinWithdrawalUsd,
        minWithdrawalPointsInr: inrCoinsNeeded,
        minWithdrawalPointsUsd: usdCoinsNeeded,

        // Backwards compatibility with existing app code and legacy schemas
        defaultInrPer1000: Number((100000 / activeCoinsPer100Inr).toFixed(4)),
        defaultUsdPer1000: Number((1000 / activeCoinsPerUsd).toFixed(6)),
        minWithdrawalAmount: activeMinWithdrawalInr,
        minWithdrawalPoints: inrCoinsNeeded,
        minWithdrawalCoins: inrCoinsNeeded,

        // ── Spin wheel ──
        spinPrizes,
        spinWheelPrizes: spinPrizes,
        spinRewards: spinPrizes,
        spinWeights,
        maxDailySpins: parseInt(fd.get('maxDailySpins') || '3'),
        totalMaxSpins: parseInt(fd.get('totalMaxSpins') || '6'),

        // ── Fallback fixed rewards ──
        watchAdReward: parseInt(fd.get('watchAdMinReward') || '10'),
        quizCompletionReward: parseInt(fd.get('quizMinReward') || '20'),
        surveyCompletionReward: parseInt(fd.get('surveyMinReward') || '15'),
        taskCompletionReward: parseInt(fd.get('taskCompletionReward') || '10'),

        // ── Mini games ──
        matchPointsPerPair: parseInt(fd.get('matchPointsPerPair') || '10'),
        matchCompletionBonus: parseInt(fd.get('matchCompletionBonus') || '20'),

        // ── Weekly challenge ──
        weeklyChallengeGoal: parseInt(fd.get('weeklyChallengeGoal') || '10'),
        weeklyChallengeBonus: parseInt(fd.get('weeklyChallengeBonus') || '50'),

        // ── Max points cap ──
        maxPoints: parseInt(fd.get('maxPoints') || '1000000'),
      };

      await setDoc(doc(db, 'AppConfig', 'main'), data, { merge: true });
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      toast.success(isMaintenance ? 'App configuration saved. Maintenance mode is ACTIVE!' : 'App configuration saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6">
            <div className="h-6 w-1/3 bg-dark-200 rounded mb-4" />
            <div className="h-32 bg-dark-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">App Configuration</h1>
          <p className="text-dark-500 mt-1">Manage maintenance mode, min-max random rewards, and app settings</p>
        </div>
        <button className="btn-secondary" onClick={() => { setMaintenanceEnabled(null); setCoinsPer100Inr(null); setCoinsPerUsd(null); setMinWithdrawalInr(null); setMinWithdrawalUsd(null); refetch(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </button>
      </div>

      {/* Maintenance Mode Status Banner */}
      {isMaintenance && (
        <div className="bg-red-500/10 border-2 border-red-500 rounded-xl p-4 flex items-center justify-between gap-4 text-red-700 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white flex-shrink-0">
              <Wrench className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <p className="font-bold text-base text-red-900">Maintenance Mode is Currently ACTIVE</p>
              <p className="text-xs text-red-700">All user apps are instantly locked with maintenance screen. Disable below to unlock.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setMaintenanceEnabled(false);
              await setDoc(doc(db, 'AppConfig', 'main'), { isMaintenanceMode: false }, { merge: true });
              queryClient.invalidateQueries({ queryKey: ['appConfig'] });
              toast.success('Maintenance mode disabled! User app unlocked.');
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            Turn Off Now
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── MAINTENANCE MODE CARD ── */}
        <div className={`card p-6 border-2 transition-colors ${isMaintenance ? 'border-red-400 bg-red-50/20' : 'border-dark-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMaintenance ? 'bg-red-100 text-red-600' : 'bg-dark-100 text-dark-600'}`}>
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-dark-900">App Maintenance Mode</h2>
                <p className="text-xs text-dark-500">Instantly locks or unlocks the user application in real-time</p>
              </div>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isMaintenance}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
              <span className={`ml-3 text-sm font-semibold ${isMaintenance ? 'text-red-600' : 'text-dark-500'}`}>
                {isMaintenance ? 'ENABLED' : 'DISABLED'}
              </span>
            </label>
          </div>

          <div className="mt-4">
            <label className="label">Custom Maintenance Notice to Users</label>
            <textarea
              name="maintenanceMessage"
              rows={2}
              defaultValue={c.maintenanceMessage || 'Spin5X is undergoing scheduled maintenance to improve your experience. We will be back online shortly!'}
              className="input text-sm"
              placeholder="Notice shown on user screens while maintenance is active..."
            />
            <p className="text-xs text-dark-400 mt-1">Users will see this custom message live inside the app with a pulsing maintenance screen.</p>
          </div>
        </div>

        {/* ── MIN & MAX RANDOM COIN REWARDS (USER REQUEST) ── */}
        <div className="card p-6 border-2 border-primary-500/20 bg-gradient-to-br from-white via-primary-50/10 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-dark-900">Random Coin Rewards (Min & Max)</h2>
              <p className="text-xs text-dark-500">Configure random coins awarded to users upon completing each activity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
            {/* 1. Daily Check-In (Day 1 - 7) */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3 md:col-span-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Daily Check-In Rewards (Day 1 to 7 Coins)</h3>
              </div>
              <p className="text-xs text-dark-500">Configure exact coins awarded to users on each check-in day from Day 1 to Day 7.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day, idx) => {
                  const defVal = (c.dailyCheckInRewards && c.dailyCheckInRewards[idx] !== undefined)
                    ? c.dailyCheckInRewards[idx]
                    : [5, 10, 15, 20, 25, 30, 50][idx];
                  return (
                    <div key={day}>
                      <label className="label text-xs font-semibold text-emerald-700">Day {day}</label>
                      <input
                        name={`checkInDay${day}`}
                        type="number"
                        min="1"
                        defaultValue={defVal}
                        className="input text-sm text-center font-bold"
                        placeholder={`D${day}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Watch & Earn (Ads) */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Watch & Earn (Ads) Reward</h3>
              </div>
              <p className="text-xs text-dark-500">User receives random coins between Min & Max for each completed video ad.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Min Coins</label>
                  <input
                    name="watchAdMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.watchAdMinReward ?? 10}
                    className="input text-sm"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins</label>
                  <input
                    name="watchAdMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.watchAdMaxReward ?? 50}
                    className="input text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            {/* 3. Quizzes */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Quizzes Reward</h3>
              </div>
              <p className="text-xs text-dark-500">Coins awarded for completing trivia quizzes, scaled by correct score.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Min Coins</label>
                  <input
                    name="quizMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.quizMinReward ?? 20}
                    className="input text-sm"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins</label>
                  <input
                    name="quizMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.quizMaxReward ?? 60}
                    className="input text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            {/* 4. Surveys */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Surveys Reward</h3>
              </div>
              <p className="text-xs text-dark-500">Coins awarded upon completing survey questions.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Min Coins</label>
                  <input
                    name="surveyMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.surveyMinReward ?? 15}
                    className="input text-sm"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins</label>
                  <input
                    name="surveyMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.surveyMaxReward ?? 45}
                    className="input text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            {/* 5. 2-Hour Mystery Box */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-dark-900 text-sm">2-Hour Mystery Box Reward</h3>
              </div>
              <p className="text-xs text-dark-500">Coins awarded when users open the 2-Hour Mystery Box (1 rewarded ad plays per box).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Min Coins</label>
                  <input
                    name="mysteryBoxMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.mysteryBoxMinReward ?? 15}
                    className="input text-sm"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins</label>
                  <input
                    name="mysteryBoxMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.mysteryBoxMaxReward ?? 40}
                    className="input text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            {/* 6. Scratch Card */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Scratch Card Reward</h3>
              </div>
              <p className="text-xs text-dark-500">Each scratch produces random coins between Min and Max coins.</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Min Coins</label>
                  <input
                    name="scratchMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.scratchMinReward ?? 5}
                    className="input text-sm"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins</label>
                  <input
                    name="scratchMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.scratchMaxReward ?? 50}
                    className="input text-sm"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label className="label text-xs">Daily Cards</label>
                  <input
                    name="maxDailyScratches"
                    type="number"
                    min="1"
                    defaultValue={c.maxDailyScratches ?? 3}
                    className="input text-sm"
                    placeholder="Cards"
                  />
                </div>
              </div>
            </div>

            {/* 6. Refer & Earn */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Refer & Earn Reward</h3>
              </div>
              <p className="text-xs text-dark-500">Coins awarded to referrer for 1 successful referral completion.</p>
              <div>
                <label className="label text-xs">Coins per 1 Referral (Default: 50)</label>
                <input
                  name="referralReward"
                  type="number"
                  min="1"
                  defaultValue={c.referralReward ?? c.referralCoins ?? c.referralMinReward ?? 50}
                  className="input text-sm font-semibold"
                  placeholder="e.g. 50"
                />
              </div>
            </div>

            {/* 7. Fun Mini-Games Reward (User Request) */}
            <div className="p-4 rounded-xl border border-dark-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-dark-900 text-sm">Fun Mini-Games (Arcade Zone)</h3>
              </div>
              <p className="text-xs text-dark-500">Coins awarded randomly to users upon winning or completing any of the fun games.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Min Coins (Default: 5)</label>
                  <input
                    name="gameMinReward"
                    type="number"
                    min="1"
                    defaultValue={c.gameMinReward ?? 5}
                    className="input text-sm"
                    placeholder="Min (e.g. 5)"
                  />
                </div>
                <div>
                  <label className="label text-xs">Max Coins (Default: 20)</label>
                  <input
                    name="gameMaxReward"
                    type="number"
                    min="1"
                    defaultValue={c.gameMaxReward ?? 20}
                    className="input text-sm"
                    placeholder="Max (e.g. 20)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coin Value & Withdrawal Rules */}
        <div className="card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-dark-200 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-dark-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                Coin Value &amp; Withdrawal Rules
              </h2>
              <p className="text-xs text-dark-500 mt-0.5">
                Set kitne coins ₹100 INR aur $1 USD ke barabar honge, aur user ke liye minimum withdrawal amount (INR/USD) set karein.
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
              Live Real-Time Sync to App
            </span>
          </div>

          {/* Section 1: Coin Value per Currency */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-dark-700 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-primary-600" />
              1. Coin Valuation (₹100 INR &amp; $1 USD)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 100 Rs ke liye kitne Coins */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-dark-900 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">₹</span>
                    100 Rs ke liye Kitne Coins?
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                    ₹100 INR Value
                  </span>
                </div>
                <input
                  name="coinsPer100Inr"
                  type="number"
                  min="100"
                  step="100"
                  value={activeCoinsPer100Inr}
                  onChange={(e) => setCoinsPer100Inr(Math.max(1, parseInt(e.target.value) || 0))}
                  className="input font-mono font-bold text-base bg-white"
                  placeholder="e.g. 20000"
                  required
                />
                <div className="space-y-1 text-xs text-dark-600 bg-white/80 p-2.5 rounded-lg border border-blue-100">
                  <div className="flex justify-between font-medium">
                    <span>₹1 INR Value:</span>
                    <span className="font-bold text-blue-700">{Math.round(activeCoinsPer100Inr / 100).toLocaleString()} Coins</span>
                  </div>
                  <div className="flex justify-between text-dark-500">
                    <span>1,000 Coins Value:</span>
                    <span className="font-semibold text-dark-700">₹{(100000 / activeCoinsPer100Inr).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 1 USD ke liye kitne Coins */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-dark-900 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">$</span>
                    1 USD ke liye Kitne Coins?
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                    $1.00 USD Value
                  </span>
                </div>
                <input
                  name="coinsPerUsd"
                  type="number"
                  min="10"
                  step="100"
                  value={activeCoinsPerUsd}
                  onChange={(e) => setCoinsPerUsd(Math.max(1, parseInt(e.target.value) || 0))}
                  className="input font-mono font-bold text-base bg-white"
                  placeholder="e.g. 20000"
                  required
                />
                <div className="space-y-1 text-xs text-dark-600 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                  <div className="flex justify-between font-medium">
                    <span>$1 USD Value:</span>
                    <span className="font-bold text-emerald-700">{activeCoinsPerUsd.toLocaleString()} Coins</span>
                  </div>
                  <div className="flex justify-between text-dark-500">
                    <span>1,000 Coins Value:</span>
                    <span className="font-semibold text-dark-700">${(1000 / activeCoinsPerUsd).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Minimum Withdrawal in INR & USD */}
          <div className="space-y-3 pt-2 border-t border-dark-100">
            <h3 className="text-xs font-bold text-dark-700 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-primary-600" />
              2. Minimum Withdrawal Amount (Fill in INR or USD)
            </h3>
            <p className="text-xs text-dark-500">
              Admin coin count calculate karne ki jagah seedha minimum currency amount (₹ ya $) enter karega. App user se automatically utne hi coins require karega.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Min Withdrawal in INR */}
              <div className="p-4 rounded-xl border border-dark-200 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-dark-900 flex items-center gap-1.5">
                    <span className="text-primary-600 font-bold">₹</span>
                    Min Withdrawal (INR)
                  </label>
                  <span className="text-xs font-semibold text-dark-500">UPI / Bank</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 font-bold">₹</span>
                  <input
                    name="minWithdrawalInr"
                    type="number"
                    min="1"
                    step="1"
                    value={activeMinWithdrawalInr}
                    onChange={(e) => setMinWithdrawalInr(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="input pl-8 font-bold text-base"
                    placeholder="e.g. 50"
                    required
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-primary-50 border border-primary-100 text-xs flex items-center justify-between">
                  <span className="text-primary-900 font-medium">User Requirement:</span>
                  <span className="font-bold text-primary-700 font-mono text-sm">{inrCoinsNeeded.toLocaleString()} Coins</span>
                </div>
              </div>

              {/* Min Withdrawal in USD */}
              <div className="p-4 rounded-xl border border-dark-200 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-dark-900 flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">$</span>
                    Min Withdrawal (USD)
                  </label>
                  <span className="text-xs font-semibold text-dark-500">PayPal</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 font-bold">$</span>
                  <input
                    name="minWithdrawalUsd"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={activeMinWithdrawalUsd}
                    onChange={(e) => setMinWithdrawalUsd(Math.max(0.1, parseFloat(e.target.value) || 0))}
                    className="input pl-8 font-bold text-base"
                    placeholder="e.g. 1"
                    required
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs flex items-center justify-between">
                  <span className="text-emerald-900 font-medium">User Requirement:</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">{usdCoinsNeeded.toLocaleString()} Coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spin Wheel */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-600" />Spin Wheel
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Spin Prizes (comma-separated)</label>
              <input name="spinPrizes" type="text" defaultValue={(c.spinPrizes || [10,20,50,5,40,0,25,15]).join(', ')} className="input" />
              <p className="text-xs text-dark-400 mt-1">Coin amounts on each wheel segment</p>
            </div>
            <div>
              <label className="label">Spin Weights (comma-separated)</label>
              <input name="spinWeights" type="text" defaultValue={(c.spinWeights || [20,15,8,25,4,20,12,18]).join(', ')} className="input" />
              <p className="text-xs text-dark-400 mt-1">Probability weights (higher = more likely)</p>
            </div>
            <div>
              <label className="label">Free Spins per Day</label>
              <input name="maxDailySpins" type="number" min="0" defaultValue={c.maxDailySpins ?? 3} className="input" />
            </div>
            <div>
              <label className="label">Total Max Spins per Day (incl. ad spins)</label>
              <input name="totalMaxSpins" type="number" min="0" defaultValue={c.totalMaxSpins ?? 6} className="input" />
            </div>
          </div>
        </div>

        {/* Mini Games & Weekly */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-accent-600" />Games & Weekly Challenge
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Points per Pair Found (Match Game)</label>
              <input name="matchPointsPerPair" type="number" min="0" defaultValue={c.matchPointsPerPair ?? 10} className="input" />
            </div>
            <div>
              <label className="label">Match Game Completion Bonus</label>
              <input name="matchCompletionBonus" type="number" min="0" defaultValue={c.matchCompletionBonus ?? 20} className="input" />
            </div>
            <div>
              <label className="label">Weekly Challenge Goal (tasks)</label>
              <input name="weeklyChallengeGoal" type="number" min="1" defaultValue={c.weeklyChallengeGoal ?? 10} className="input" />
            </div>
            <div>
              <label className="label">Weekly Challenge Bonus</label>
              <input name="weeklyChallengeBonus" type="number" min="0" defaultValue={c.weeklyChallengeBonus ?? 50} className="input" />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex gap-3 pt-4 border-t border-dark-200">
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button type="button" className="btn-outline flex-1" onClick={() => { setMaintenanceEnabled(null); setCoinsPer100Inr(null); setCoinsPerUsd(null); setMinWithdrawalInr(null); setMinWithdrawalUsd(null); refetch(); }}>
            Reset to Saved
          </button>
        </div>
      </form>

      {/* About */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-dark-900">About</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-dark-50 rounded-lg"><p className="text-xs text-dark-500">App</p><p className="font-medium text-dark-900">Spin5X Admin</p></div>
          <div className="p-3 bg-dark-50 rounded-lg"><p className="text-xs text-dark-500">Version</p><p className="font-medium text-dark-900">2.1.0</p></div>
          <div className="p-3 bg-dark-50 rounded-lg"><p className="text-xs text-dark-500">Framework</p><p className="font-medium text-dark-900">React 18 + Vite</p></div>
          <div className="p-3 bg-dark-50 rounded-lg"><p className="text-xs text-dark-500">Backend</p><p className="font-medium text-dark-900">Firebase Firestore</p></div>
        </div>
      </div>
    </div>
  );
}
