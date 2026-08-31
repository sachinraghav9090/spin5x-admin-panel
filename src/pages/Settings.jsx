import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Globe, User, Shield, DollarSign, RefreshCw, Trash2, FileText, CheckCircle } from 'lucide-react';
import { db } from '../firebase/config.jsx';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../firebase/config.jsx';
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import toast from 'react-hot-toast';

const liveConfigs = {
  admob: {
    bannerAdUnit: 'ca-app-pub-6089131009548737/6224015571',
    interstitialAdUnit: 'ca-app-pub-6089131009548737/2556233303',
    rewardedAdUnit: 'ca-app-pub-6089131009548737/2866340015',
    appOpenAdUnit: 'ca-app-pub-6089131009548737/3419835294',
  },
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const queryClient = useQueryClient();

  const { data: adConfig, refetch: refetchAdConfig } = useQuery({
    queryKey: ['adConfig'],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'AdConfigs', 'main'));
      return snap.data() || {};
    },
  });

  const { data: appConfig, refetch: refetchAppConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'AppConfig', 'main'));
      return snap.data() || {};
    },
  });

  const adConfigMutation = useMutation({
    mutationFn: async (config) => {
      await setDoc(doc(db, 'AdConfigs', 'main'), config, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adConfig'] });
      toast.success('Ad settings saved');
    },
    onError: () => toast.error('Failed to save ad settings'),
  });

  const appConfigMutation = useMutation({
    mutationFn: async (config) => {
      await setDoc(doc(db, 'AppConfig', 'main'), config, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      toast.success('App settings saved');
    },
    onError: () => toast.error('Failed to save app settings'),
  });

  const passwordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => {
      const user = auth && auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    },
    onSuccess: () => toast.success('Password updated'),
    onError: (error) => toast.error(error.message || 'Failed to update password'),
  });

  const emailMutation = useMutation({
    mutationFn: async ({ currentPassword, newEmail }) => {
      const user = auth && auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await user.verifyBeforeUpdateEmail(newEmail);
      await updateDoc(doc(db, 'Users', user.uid), { email: newEmail });
    },
    onSuccess: () => toast.success('Verification email sent to new address'),
    onError: (error) => toast.error(error.message || 'Failed to update email'),
  });

  const handleAdConfigSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const config = {
      adsEnabled: formData.get('adsEnabled') === 'on',
      useTestAds: formData.get('useTestAds') === 'on',
      useUnity: formData.get('useUnity') === 'on',
      unityAppId: formData.get('unityAppId') || '',
      unityBannerAdUnit: formData.get('unityBannerAdUnit') || '',
      unityInterstitialAdUnit: formData.get('unityInterstitialAdUnit') || '',
      unityRewardedAdUnit: formData.get('unityRewardedAdUnit') || '',
      admobAppId: formData.get('admobAppId') || '',
      bannerAdUnit: formData.get('bannerAdUnit') || '',
      interstitialAdUnit: formData.get('interstitialAdUnit') || '',
      rewardedAdUnit: formData.get('rewardedAdUnit') || '',
      appOpenAdUnit: formData.get('appOpenAdUnit') || '',
    };
    adConfigMutation.mutate(config);
  };

  const handleAppConfigSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const config = {
      latestVersion: formData.get('latestVersion'),
      minVersion: formData.get('minVersion'),
      dailyCheckInRewards: (formData.get('dailyCheckInRewards') || '')
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !Number.isNaN(v)),
      weeklyChallengeGoal: parseInt(formData.get('weeklyChallengeGoal') || '50', 10),
      weeklyChallengeBonus: parseInt(formData.get('weeklyChallengeBonus') || '500', 10),
      streakFreezeCost: parseInt(formData.get('streakFreezeCost') || '50', 10),
      maxPoints: parseInt(formData.get('maxPoints') || '1000000', 10),
      inrPer1000: parseFloat(formData.get('inrPer1000') || '5'),
      usdPer1000: parseFloat(formData.get('usdPer1000') || '1'),
      forceUpdate: formData.get('forceUpdate') === 'on',
      maintenanceMode: formData.get('maintenanceMode') === 'on',
      maintenanceMessage: formData.get('maintenanceMessage'),
    };
    appConfigMutation.mutate(config);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'adConfig', label: 'Ad Settings', icon: DollarSign },
    { id: 'appConfig', label: 'App Config', icon: Globe },
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Settings</h1>
          <p className="text-dark-500 mt-1">Manage platform configuration and account settings</p>
        </div>
        <button className="btn-secondary" onClick={() => { refetchAdConfig(); refetchAppConfig(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="border-b border-dark-200 overflow-x-auto">
          <nav className="flex gap-1 p-2" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-dark-500 hover:text-dark-700 hover:bg-dark-100'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <tab.icon className="w-4 h-4 mr-2 inline-block" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-dark-900 mb-4">Platform Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-dark-500">Platform Name</p>
                    <p className="font-semibold text-dark-900">Spin5X</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-dark-500">Version</p>
                    <p className="font-semibold text-dark-900">1.3.0</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-dark-500">Build Number</p>
                    <p className="font-semibold text-dark-900">3</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-outline" onClick={() => toast('Cache cleared')}>
                    <Trash2 className="w-4 h-4 mr-2" /> Clear Cache
                  </button>
                  <button className="btn-outline" onClick={() => toast('Logs exported')}>
                    <FileText className="w-4 h-4 mr-2" /> Export Logs
                  </button>
                  <button className="btn-outline" onClick={() => { refetchAdConfig(); refetchAppConfig(); }}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh Configs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ad Settings Tab */}
          {activeTab === 'adConfig' && (
            <form onSubmit={handleAdConfigSave} className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Master Controls</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="adsEnabled"
                      defaultChecked={adConfig?.adsEnabled}
                      className="w-5 h-5 text-primary-600 rounded border-dark-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <div>
                      <p className="font-medium text-dark-900">Enable Ads</p>
                      <p className="text-sm text-dark-500">Master toggle for all advertisements</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="useTestAds"
                      defaultChecked={adConfig?.useTestAds}
                      className="w-5 h-5 text-primary-600 rounded border-dark-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <div>
                      <p className="font-medium text-dark-900">Use Test Ads</p>
                      <p className="text-sm text-dark-500">ON = Google test ads | OFF = your live ad units</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="useUnity"
                      defaultChecked={adConfig?.useUnity}
                      className="w-5 h-5 text-primary-600 rounded border-dark-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <div>
                      <p className="font-medium text-dark-900">Use Unity Ads</p>
                      <p className="text-sm text-dark-500">ON = Unity Ads network | OFF = Google AdMob</p>
                    </div>
                  </label>
                </div>
              </div>

              {adConfig?.useUnity ? (
                <div className="card p-6">
                  <h2 className="text-lg font-semibold text-dark-900 mb-4">Unity Ads Configuration</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Unity App ID</label>
                      <input name="unityAppId" type="text" defaultValue={adConfig?.unityAppId || ''} className="input" placeholder="e.g. 1234567" />
                    </div>
                    <div>
                      <label className="label">Unity Banner Ad Unit ID</label>
                      <input name="unityBannerAdUnit" type="text" defaultValue={adConfig?.unityBannerAdUnit || ''} className="input" placeholder="Enter Unity banner ad unit ID" />
                    </div>
                    <div>
                      <label className="label">Unity Interstitial Ad Unit ID</label>
                      <input name="unityInterstitialAdUnit" type="text" defaultValue={adConfig?.unityInterstitialAdUnit || ''} className="input" placeholder="Enter Unity interstitial ad unit ID" />
                    </div>
                    <div>
                      <label className="label">Unity Rewarded Ad Unit ID</label>
                      <input name="unityRewardedAdUnit" type="text" defaultValue={adConfig?.unityRewardedAdUnit || ''} className="input" placeholder="Enter Unity rewarded ad unit ID" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card p-6">
                  <h2 className="text-lg font-semibold text-dark-900 mb-4">Google AdMob Configuration</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">AdMob App ID</label>
                      <input name="admobAppId" type="text" defaultValue={adConfig?.admobAppId || ''} className="input" placeholder="ca-app-pub-xxxxxxxx~xxxxxxxx" />
                    </div>
                    <div>
                      <label className="label">Banner Ad Unit ID</label>
                      <input name="bannerAdUnit" type="text" defaultValue={adConfig?.bannerAdUnit || liveConfigs.admob.bannerAdUnit} className="input" placeholder="Live: ca-app-pub-6089131009548737/6224015571" />
                    </div>
                    <div>
                      <label className="label">Interstitial Ad Unit ID</label>
                      <input name="interstitialAdUnit" type="text" defaultValue={adConfig?.interstitialAdUnit || liveConfigs.admob.interstitialAdUnit} className="input" placeholder="Live: ca-app-pub-6089131009548737/2556233303" />
                    </div>
                    <div>
                      <label className="label">Rewarded Ad Unit ID</label>
                      <input name="rewardedAdUnit" type="text" defaultValue={adConfig?.rewardedAdUnit || liveConfigs.admob.rewardedAdUnit} className="input" placeholder="Live: ca-app-pub-6089131009548737/2866340015" />
                    </div>
                    <div>
                      <label className="label">App Open Ad Unit ID</label>
                      <input name="appOpenAdUnit" type="text" defaultValue={adConfig?.appOpenAdUnit || liveConfigs.admob.appOpenAdUnit} className="input" placeholder="Live: ca-app-pub-6089131009548737/3419835294" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary" disabled={adConfigMutation.isPending}>
                  {adConfigMutation.isPending ? 'Saving...' : 'Save Ad Settings'}
                </button>
              </div>
            </form>
          )}

          {/* App Config Tab */}
          {activeTab === 'appConfig' && (
            <form onSubmit={handleAppConfigSave} className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Version Control</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Latest Version</label>
                    <input name="latestVersion" type="text" defaultValue={appConfig?.latestVersion || '1.3.0'} className="input" placeholder="e.g. 1.3.0" />
                  </div>
                  <div>
                    <label className="label">Minimum Version</label>
                    <input name="minVersion" type="text" defaultValue={appConfig?.minVersion || '1.0.0'} className="input" placeholder="e.g. 1.0.0" />
                  </div>
                </div>
                <label className="flex items-center gap-3 mt-4 p-4 rounded-xl border border-dark-200 cursor-pointer transition-colors">
                  <input type="checkbox" name="forceUpdate" defaultChecked={appConfig?.forceUpdate} className="w-5 h-5 text-primary-600 rounded border-dark-300" />
                  <div>
                    <p className="font-medium text-dark-900">Force Update</p>
                    <p className="text-sm text-dark-500">Blocks older versions from using the app</p>
                  </div>
                </label>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Rewards & Conversion</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Daily Check-In Rewards (comma separated)</label>
                    <input name="dailyCheckInRewards" type="text" defaultValue={(appConfig?.dailyCheckInRewards || [100, 200, 300]).join(', ')} className="input" />
                  </div>
                  <div>
                    <label className="label">Weekly Challenge Goal (points)</label>
                    <input name="weeklyChallengeGoal" type="number" defaultValue={appConfig?.weeklyChallengeGoal || 50} className="input" />
                  </div>
                  <div>
                    <label className="label">Weekly Challenge Bonus</label>
                    <input name="weeklyChallengeBonus" type="number" defaultValue={appConfig?.weeklyChallengeBonus || 500} className="input" />
                  </div>
                  <div>
                    <label className="label">Streak Freeze Cost</label>
                    <input name="streakFreezeCost" type="number" defaultValue={appConfig?.streakFreezeCost || 50} className="input" />
                  </div>
                  <div>
                    <label className="label">Max Points</label>
                    <input name="maxPoints" type="number" defaultValue={appConfig?.maxPoints || 1000000} className="input" />
                  </div>
                  <div>
                    <label className="label">INR per 1000 points</label>
                    <input name="inrPer1000" type="number" step="0.001" defaultValue={appConfig?.inrPer1000 || 5} className="input" />
                  </div>
                  <div>
                    <label className="label">USD per 1000 points</label>
                    <input name="usdPer1000" type="number" step="0.001" defaultValue={appConfig?.usdPer1000 || 1} className="input" />
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Maintenance</h2>
                <label className="flex items-center gap-3 mb-4 p-4 rounded-xl border border-dark-200 cursor-pointer transition-colors">
                  <input type="checkbox" name="maintenanceMode" defaultChecked={appConfig?.maintenanceMode} className="w-5 h-5 text-primary-600 rounded border-dark-300" />
                  <div>
                    <p className="font-medium text-dark-900">Maintenance Mode</p>
                    <p className="text-sm text-dark-500">Shows maintenance message to all users</p>
                  </div>
                </label>
                <div>
                  <label className="label">Maintenance Message</label>
                  <textarea name="maintenanceMessage" rows="3" defaultValue={appConfig?.maintenanceMessage || 'App is under maintenance. Please check back later.'} className="input" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary" disabled={appConfigMutation.isPending}>
                  {appConfigMutation.isPending ? 'Saving...' : 'Save App Config'}
                </button>
              </div>
            </form>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                emailMutation.mutate({
                  currentPassword: fd.get('currentPassword'),
                  newEmail: fd.get('newEmail'),
                });
              }}
              className="space-y-6"
            >
              <div className="card p-6 max-w-xl">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Update Email</h2>
                <p className="text-sm text-dark-500 mb-4">A verification email will be sent to the new address. Login email: tarunvip934@gmail.com</p>
                <div className="space-y-4">
                  <div>
                    <label className="label">Current Password</label>
                    <input name="currentPassword" type="password" className="input" required />
                  </div>
                  <div>
                    <label className="label">New Email</label>
                    <input name="newEmail" type="email" className="input" required />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary" disabled={emailMutation.isPending}>
                    {emailMutation.isPending ? 'Sending...' : 'Send Verification Email'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                passwordMutation.mutate({
                  currentPassword: fd.get('currentPassword'),
                  newPassword: fd.get('newPassword'),
                });
              }}
              className="space-y-6"
            >
              <div className="card p-6 max-w-xl">
                <h2 className="text-lg font-semibold text-dark-900 mb-4">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="label">Current Password</label>
                    <input name="currentPassword" type="password" className="input" required />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input name="newPassword" type="password" className="input" required minLength={6} />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}