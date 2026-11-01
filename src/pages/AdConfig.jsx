import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, CheckCircle, AlertTriangle, DollarSign, Smartphone } from 'lucide-react';
import { db } from '../firebase/config.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const LIVE_ADMOB = {
  bannerAdUnit: 'ca-app-pub-6089131009548737/6224015571',
  interstitialAdUnit: 'ca-app-pub-6089131009548737/2556233303',
  rewardedAdUnit: 'ca-app-pub-6089131009548737/2866340015',
  appOpenAdUnit: 'ca-app-pub-6089131009548737/3419835294',
};

export default function AdConfig() {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: adConfig, refetch } = useQuery({
    queryKey: ['adConfig'],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'AdConfigs', 'main'));
      return snap.data() || {};
    },
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const config = {
        adsEnabled: fd.get('adsEnabled') === 'on',
        useTestAds: false,
        useUnity: fd.get('useUnity') === 'on',
        unityAppId: fd.get('unityAppId') || '',
        unityBannerAdUnit: fd.get('unityBannerAdUnit') || '',
        unityInterstitialAdUnit: fd.get('unityInterstitialAdUnit') || '',
        unityRewardedAdUnit: fd.get('unityRewardedAdUnit') || '',
        admobAppId: fd.get('admobAppId') || '',
        bannerAdUnit: fd.get('bannerAdUnit') || '',
        interstitialAdUnit: fd.get('interstitialAdUnit') || '',
        rewardedAdUnit: fd.get('rewardedAdUnit') || '',
        appOpenAdUnit: fd.get('appOpenAdUnit') || '',
      };
      await setDoc(doc(db, 'AdConfigs', 'main'), config, { merge: true });
      queryClient.invalidateQueries({ queryKey: ['adConfig'] });
      toast.success('Ad settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save ad settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Ad Configuration</h1>
          <p className="text-dark-500 mt-1">Manage real ad network settings, Unity vs AdMob, and live ad unit IDs</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Master Controls */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Master Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
              <input type="checkbox" name="adsEnabled" defaultChecked={adConfig?.adsEnabled !== false} className="w-5 h-5 text-primary-600 rounded border-dark-300 focus:ring-2 focus:ring-primary-500" />
              <div><p className="font-medium text-dark-900">Enable Live Ads</p><p className="text-sm text-dark-500">Master switch for all advertisements in the app</p></div>
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
              <input type="checkbox" name="useUnity" defaultChecked={adConfig?.useUnity} className="w-5 h-5 text-primary-600 rounded border-dark-300 focus:ring-2 focus:ring-primary-500" />
              <div><p className="font-medium text-dark-900">Use Unity Ads</p><p className="text-sm text-dark-500">ON = Unity Ads | OFF = Google AdMob</p></div>
            </label>
          </div>
        </div>

        {/* Unity Ads */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-purple-600" />Unity Ads Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Unity App ID</label><input name="unityAppId" type="text" defaultValue={adConfig?.unityAppId || ''} className="input" placeholder="e.g. 1234567" /></div>
            <div><label className="label">Unity Banner Ad Unit ID</label><input name="unityBannerAdUnit" type="text" defaultValue={adConfig?.unityBannerAdUnit || ''} className="input" placeholder="Enter Unity banner ad unit ID" /></div>
            <div><label className="label">Unity Interstitial Ad Unit ID</label><input name="unityInterstitialAdUnit" type="text" defaultValue={adConfig?.unityInterstitialAdUnit || ''} className="input" placeholder="Enter Unity interstitial ad unit ID" /></div>
            <div><label className="label">Unity Rewarded Ad Unit ID</label><input name="unityRewardedAdUnit" type="text" defaultValue={adConfig?.unityRewardedAdUnit || ''} className="input" placeholder="Enter Unity rewarded ad unit ID" /></div>
          </div>
        </div>

        {/* AdMob */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-600" />Google AdMob Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">AdMob App ID</label><input name="admobAppId" type="text" defaultValue={adConfig?.admobAppId || ''} className="input" placeholder="ca-app-pub-xxxxxxxx~xxxxxxxx" /></div>
            <div><label className="label">Banner Ad Unit ID</label><input name="bannerAdUnit" type="text" defaultValue={adConfig?.bannerAdUnit || LIVE_ADMOB.bannerAdUnit} className="input" /></div>
            <div><label className="label">Interstitial Ad Unit ID</label><input name="interstitialAdUnit" type="text" defaultValue={adConfig?.interstitialAdUnit || LIVE_ADMOB.interstitialAdUnit} className="input" /></div>
            <div><label className="label">Rewarded Ad Unit ID</label><input name="rewardedAdUnit" type="text" defaultValue={adConfig?.rewardedAdUnit || LIVE_ADMOB.rewardedAdUnit} className="input" /></div>
            <div><label className="label">App Open Ad Unit ID</label><input name="appOpenAdUnit" type="text" defaultValue={adConfig?.appOpenAdUnit || LIVE_ADMOB.appOpenAdUnit} className="input" /></div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200">
            <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Live Ad Units Configured</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded border border-green-100">
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded"><span className="text-green-600">Banner:</span><code>{LIVE_ADMOB.bannerAdUnit}</code></div>
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded"><span className="text-green-600">Interstitial:</span><code>{LIVE_ADMOB.interstitialAdUnit}</code></div>
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded"><span className="text-green-600">Rewarded:</span><code>{LIVE_ADMOB.rewardedAdUnit}</code></div>
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded"><span className="text-green-600">App Open:</span><code>{LIVE_ADMOB.appOpenAdUnit}</code></div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3 pt-4 border-t border-dark-200">
          <button type="submit" className="btn-primary flex-1" disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Ad Settings'}</button>
          <button type="button" className="btn-outline flex-1" onClick={() => refetch()}>Reset to Saved</button>
        </div>
      </form>

      {/* Notes */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-blue-600" />Live Production Mode</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />All ad units are set to Live Production mode for maximum revenue</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />Changes take effect instantly for all active mobile users</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />Switch seamlessly between Google AdMob and Unity Ads using the toggle above</li>
        </ul>
      </div>

      {/* Status */}
      <div className="card p-6">
        <h3 className="font-semibold text-dark-900 mb-4">Current Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
            <p className="text-sm text-primary-600">Ads Status</p>
            <p className={`font-bold text-lg ${adConfig?.adsEnabled !== false ? 'text-emerald-600' : 'text-red-600'}`}>{adConfig?.adsEnabled !== false ? 'Active & Live' : 'Disabled'}</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
            <p className="text-sm text-purple-600">Active Network</p>
            <p className="font-bold text-lg text-purple-700">{adConfig?.useUnity ? 'Unity Ads' : 'Google AdMob'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
