import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Save, 
  RefreshCw, 
  ToggleLeft, 
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Smartphone,
  CreditCard,
  Globe,
  Loader2,
} from 'lucide-react';
import { db } from '../firebase/config.jsx';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import toast from 'react-hot-toast';

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

  const liveConfigs = {
    admob: {
      bannerAdUnit: 'ca-app-pub-6089131009548737/6224015571',
      interstitialAdUnit: 'ca-app-pub-6089131009548737/2556233303',
      rewardedAdUnit: 'ca-app-pub-6089131009548737/2866340015',
      appOpenAdUnit: 'ca-app-pub-6089131009548737/3419835294',
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        
        <h1 className="text-2xl font-bold text-dark-900">Ad Configuration</h1>
        <p className="text-dark-500 mt-1">Manage ad network settings, test/live modes, and ad unit IDs</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Master Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                name="adsEnabled" 
                defaultChecked={adConfig?.adsEnabled !== false} 
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
                defaultChecked={adConfig?.useTestAds === true} 
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

        {/* Unity Ads Section */}
        {adConfig?.useUnity ? (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Unity Ads Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Unity App ID</label>
                <input 
                  name="unityAppId" 
                  type="text" 
                  defaultValue={adConfig?.unityAppId || ''} 
                  className="input" 
                  placeholder="e.g. 1234567"
                />
              </div>
              <div>
                <label className="label">Unity Banner Ad Unit ID</label>
                <input 
                  name="unityBannerAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.unityBannerAdUnit || ''} 
                  className="input" 
                  placeholder="Enter Unity banner ad unit ID"
                />
              </div>
              <div>
                <label className="label">Unity Interstitial Ad Unit ID</label>
                <input 
                  name="unityInterstitialAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.unityInterstitialAdUnit || ''} 
                  className="input" 
                  placeholder="Enter Unity interstitial ad unit ID"
                />
              </div>
              <div>
                <label className="label">Unity Rewarded Ad Unit ID</label>
                <input 
                  name="unityRewardedAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.unityRewardedAdUnit || ''} 
                  className="input" 
                  placeholder="Enter Unity rewarded ad unit ID"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              Google AdMob Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">AdMob App ID</label>
                <input 
                  name="admobAppId" 
                  type="text" 
                  defaultValue={adConfig?.admobAppId || ''} 
                  className="input" 
                  placeholder="ca-app-pub-xxxxxxxx~xxxxxxxx"
                />
              </div>
              <div>
                <label className="label">Banner Ad Unit ID</label>
                <input 
                  name="bannerAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.bannerAdUnit || liveConfigs.admob.bannerAdUnit} 
                  className="input" 
                  placeholder="Live: ca-app-pub-6089131009548737/6224015571"
                />
              </div>
              <div>
                <label className="label">Interstitial Ad Unit ID</label>
                <input 
                  name="interstitialAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.interstitialAdUnit || liveConfigs.admob.interstitialAdUnit} 
                  className="input" 
                  placeholder="Live: ca-app-pub-6089131009548737/2556233303"
                />
              </div>
              <div>
                <label className="label">Rewarded Ad Unit ID</label>
                <input 
                  name="rewardedAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.rewardedAdUnit || liveConfigs.admob.rewardedAdUnit} 
                  className="input" 
                  placeholder="Live: ca-app-pub-6089131009548737/2866340015"
                />
              </div>
              <div>
                <label className="label">App Open Ad Unit ID</label>
                <input 
                  name="appOpenAdUnit" 
                  type="text" 
                  defaultValue={adConfig?.appOpenAdUnit || liveConfigs.admob.appOpenAdUnit} 
                  className="input" 
                  placeholder="Live: ca-app-pub-6089131009548737/3419835294"
                />
              </div>
            </div>
            
            {/* Live Ads Info */}
            <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200">
              <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Live Ad Units Configured
              </h4>
              <p className="text-sm text-green-700 mb-3">
                These are your live AdMob ad unit IDs. They will serve real ads and generate revenue.
                Make sure test mode is OFF in Master Controls for these to work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded border border-green-100">
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <span className="text-green-600">Banner:</span>
                  <code>{liveConfigs.admob.bannerAdUnit}</code>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <span className="text-green-600">Interstitial:</span>
                  <code>{liveConfigs.admob.interstitialAdUnit}</code>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <span className="text-green-600">Rewarded:</span>
                  <code>{liveConfigs.admob.rewardedAdUnit}</code>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <span className="text-green-600">App Open:</span>
                  <code>{liveConfigs.admob.appOpenAdUnit}</code>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Save Button */}
        <div className="flex gap-3 pt-4 border-t border-dark-200">
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Ad Settings'}
          </button>
          <button type="button" className="btn-outline flex-1" onClick={() => refetch()}>
            Reset to Saved
          </button>
        </div>
      </form>

      {/* Important Notes */}
      <div className="card p-6 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Important Notes
        </h3>
        <ul className="space-y-2 text-sm text-amber-700">
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Changes apply immediately to all users</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Test ad units never generate real revenue</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Live ad units are configured - disable test mode to use them</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />AdMob App ID must be set for Android (in AndroidManifest.xml) and iOS (in Info.plist)</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Unity Ads require separate Unity dashboard setup</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Always test with test ads before releasing to production</li>
        </ul>
      </div>

      {/* Current Status */}
      <div className="card p-6">
        <h3 className="font-semibold text-dark-900 mb-4">Current Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
            <p className="text-sm text-primary-600">Ads Status</p>
            <p className={`font-bold text-lg ${adConfig?.adsEnabled ? 'text-primary-700' : 'text-red-600'}`}>
              {adConfig?.adsEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-100">
            <p className="text-sm text-secondary-600">Test Mode</p>
            <p className={`font-bold text-lg ${adConfig?.useTestAds ? 'text-secondary-700' : 'text-green-600'}`}>
              {adConfig?.useTestAds ? 'Test Ads' : 'Live Ads'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
            <p className="text-sm text-purple-600">Network</p>
            <p className="font-bold text-lg text-purple-700">
              {adConfig?.useUnity ? 'Unity Ads' : 'Google AdMob'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const liveConfigs = {
  admob: {
    bannerAdUnit: 'ca-app-pub-6089131009548737/6224015571',
    interstitialAdUnit: 'ca-app-pub-6089131009548737/2556233303',
    rewardedAdUnit: 'ca-app-pub-6089131009548737/2866340015',
    appOpenAdUnit: 'ca-app-pub-6089131009548737/3419835294',
  }
};