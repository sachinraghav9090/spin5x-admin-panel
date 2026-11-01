import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, RefreshCw, Sparkles, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../firebase/config.js';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, updateDoc, doc, getDoc, setDoc, addDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

const DEFAULT_BUSINESS_QUESTIONS = [
  {
    question: 'How do you primarily evaluate new business software or digital tools before adoption?',
    options: ['Customer reviews and peer recommendations', 'Free trial hands-on testing', 'Brand reputation and market leadership', 'Pricing tiers and discount structures']
  },
  {
    question: 'What is the most effective approach for continuous professional skill development?',
    options: ['Interactive online courses and certifications', 'Mentorship and on-the-job apprenticeship', 'Reading industry research whitepapers and books', 'Attending annual conferences and seminars']
  },
  {
    question: 'How frequently does your organization or study group review financial budgets?',
    options: ['Weekly active tracking', 'Monthly reconciliation', 'Quarterly executive review', 'Only during annual tax filings']
  },
  {
    question: 'What factor most strongly drives long-term customer loyalty in modern business?',
    options: ['Exceptional proactive customer support', 'Lowest price in the competitive market', 'Product quality and consistent reliability', 'Brand prestige and aesthetic packaging']
  },
  {
    question: 'Which metric best reflects sustainable business health over quarterly vanity numbers?',
    options: ['Customer Lifetime Value (LTV) to Acquisition Cost (CAC) ratio', 'Gross aggregate social media impressions', 'Total registered account signups without retention', 'Short-term promotional revenue spikes']
  },
  {
    question: 'What role does AI play in improving team productivity in your daily workflow?',
    options: ['Automating repetitive documentation and administrative tasks', 'Data synthesis, research, and predictive analytics', 'Brainstorming ideas and creative drafting', 'Rarely or never used currently']
  },
  {
    question: 'What is the biggest operational risk when scaling an early-stage startup?',
    options: ['Premature scaling before reaching product-market fit', 'Inadequate working capital and cash burn mismanagement', 'Hiring misaligned talent too rapidly', 'Over-relying on a single customer or supplier']
  },
  {
    question: 'How do you measure the educational effectiveness of online micro-learning modules?',
    options: ['Practical project completion and knowledge retention tests', 'Course video playback completion percentage', 'User satisfaction surveys and net promoter score', 'Speed of module completion']
  },
  {
    question: 'What marketing channel delivers the highest return on investment (ROI) for educational products?',
    options: ['Organic search engine optimization (SEO) and educational blogs', 'High-conversion email newsletters and nurture drips', 'Targeted social media video ads (TikTok, Instagram, YouTube)', 'Influencer sponsorships and podcast endorsements']
  },
  {
    question: 'Which leadership quality is most vital for managing cross-functional remote teams?',
    options: ['Clear, asynchronous written communication and transparency', 'Strict micro-management and constant status meetings', 'Hands-off delegation with minimal follow-up', 'Enforcing strict identical physical office hours']
  }
];

export default function Surveys() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [questions, setQuestions] = useState([{ question: '', options: ['', '', '', ''] }]);
  const [upgrading, setUpgrading] = useState(false);
  const [globalMinReward, setGlobalMinReward] = useState(15);
  const [globalMaxReward, setGlobalMaxReward] = useState(45);
  const [savingBulkCoins, setSavingBulkCoins] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    getDoc(doc(db, 'AppConfig', 'main'))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.surveyMinReward) setGlobalMinReward(d.surveyMinReward);
          if (d.surveyMaxReward) setGlobalMaxReward(d.surveyMaxReward);
        }
      })
      .catch((err) => console.error('Failed to load AppConfig for surveys:', err));
  }, []);

  const handleSaveBulkSurveyCoins = async () => {
    if (globalMinReward <= 0 || globalMaxReward <= 0) {
      toast.error('Coins must be greater than 0');
      return;
    }
    const min = Math.min(globalMinReward, globalMaxReward);
    const max = Math.max(globalMinReward, globalMaxReward);
    setSavingBulkCoins(true);
    try {
      // 1. Update AppConfig/main for real-time app sync across all users
      await setDoc(
        doc(db, 'AppConfig', 'main'),
        {
          surveyMinReward: min,
          surveyMaxReward: max,
          surveyCompletionReward: min,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Also update all existing Surveys in collection
      const snap = await getDocs(collection(db, 'Surveys'));
      let updatedCount = 0;
      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          minReward: min,
          maxReward: max,
          points: min,
          updatedAt: serverTimestamp(),
        });
        updatedCount++;
      }

      toast.success(`Success! All surveys updated to ${min}-${max} Coins. Real-time sync active.`);
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      refetch();
    } catch (err) {
      toast.error('Failed to update survey coins: ' + err.message);
    } finally {
      setSavingBulkCoins(false);
    }
  };

  const buildQuery = (cursor = null) => {
    const col = collection(db, 'Surveys');
    const [field, dir] = sortBy.split('_');
    const constraints = [orderBy(field, dir), limit(ITEMS_PER_PAGE)];
    if (cursor) constraints.push(startAfter(cursor));
    if (statusFilter === 'active') constraints.unshift(where('isActive', '==', true));
    else if (statusFilter === 'inactive') constraints.unshift(where('isActive', '==', false));
    return query(col, ...constraints);
  };

  const { data: surveysData, isLoading, refetch } = useQuery({
    queryKey: ['surveys', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Surveys'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.title?.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())).slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      return list;
    },
    placeholderData: (prev) => prev,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['surveysCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      const col = collection(db, 'Surveys');
      const constraints = [];
      if (statusFilter === 'active') constraints.push(where('isActive', '==', true));
      else if (statusFilter === 'inactive') constraints.push(where('isActive', '==', false));
      const snap = await getCountFromServer(query(col, ...constraints));
      return snap.data().count;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ survey, isEdit }) => {
      const data = { ...survey, updatedAt: Timestamp.now() };
      delete data.id;
      if (isEdit) await updateDoc(doc(db, 'Surveys', editingSurvey.id), data);
      else { data.createdAt = Timestamp.now(); await addDoc(collection(db, 'Surveys'), data); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success(editingSurvey ? 'Survey updated' : 'Survey created');
      closeModal();
    },
    onError: () => toast.error('Failed to save survey'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await deleteDoc(doc(db, 'Surveys', id)); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['surveys'] }); toast.success('Survey deleted'); },
    onError: () => toast.error('Failed to delete survey'),
  });

  const createTenEmptyQuestions = () => Array.from({ length: 10 }, () => ({ question: '', options: ['', '', '', ''] }));

  const upgradeAllSurveysTo10Questions = async () => {
    try {
      setUpgrading(true);
      const snap = await getDocs(collection(db, 'Surveys'));
      let upgradedCount = 0;
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const existingQs = data.questions || [];
        if (existingQs.length < 10) {
          const needed = 10 - existingQs.length;
          const extraQs = DEFAULT_BUSINESS_QUESTIONS
            .filter((q) => !existingQs.some((eq) => eq.question === q.question))
            .slice(0, needed);
          const fullQs = [...existingQs, ...extraQs];
          while (fullQs.length < 10) {
            fullQs.push(DEFAULT_BUSINESS_QUESTIONS[fullQs.length % DEFAULT_BUSINESS_QUESTIONS.length]);
          }
          await updateDoc(docSnap.ref, {
            questions: fullQs,
            points: Math.max(data.points || 0, 50),
          });
          upgradedCount++;
        }
      }
      toast.success(
        upgradedCount > 0
          ? `Successfully upgraded ${upgradedCount} surveys to 10 questions each!`
          : 'All surveys already have 10 questions!'
      );
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      refetch();
    } catch (err) {
      toast.error('Failed to upgrade surveys: ' + err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const openCreate = () => { setEditingSurvey(null); setQuestions(createTenEmptyQuestions()); setShowModal(true); };
  const openEdit = (survey) => {
    setEditingSurvey(survey);
    let qs = survey.questions && survey.questions.length > 0 ? [...survey.questions] : createTenEmptyQuestions();
    if (qs.length < 10) {
      const extra = DEFAULT_BUSINESS_QUESTIONS.filter(
        (cand) => !qs.some((q) => q.question === cand.question)
      ).slice(0, 10 - qs.length);
      qs = [...qs, ...extra];
      while (qs.length < 10) {
        qs.push({ question: '', options: ['', '', '', ''] });
      }
    }
    setQuestions(qs);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingSurvey(null); };
  const addQuestion = () => { if (questions.length < 10) setQuestions([...questions, { question: '', options: ['', '', '', ''] }]); };
  const removeQuestion = (index) => { if (questions.length > 1) setQuestions(questions.filter((_, i) => i !== index)); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const builtQuestions = questions.map((_, i) => {
      const question = (fd.get('q_' + i + '_text') || '').trim();
      const options = [
        fd.get('q_' + i + '_o0') || '',
        fd.get('q_' + i + '_o1') || '',
        fd.get('q_' + i + '_o2') || '',
        fd.get('q_' + i + '_o3') || '',
      ].map((o) => o.trim()).filter(Boolean);
      return { question, options };
    }).filter((q) => q.question);

    if (builtQuestions.length < 10) {
      toast.error(`Har ek survey mein 10 questions aana chahiye (Current: ${builtQuestions.length}/10).`);
      return;
    }

    const survey = {
      title: fd.get('title'),
      description: fd.get('description'),
      points: parseInt(fd.get('points') || '50'),
      questions: builtQuestions,
      isActive: fd.get('isActive') === 'on',
    };
    saveMutation.mutate({ survey, isEdit: !!editingSurvey });
  };

  const surveys = surveysData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Surveys Management</h1>
          <p className="text-dark-500 mt-1">Create and manage surveys for users (10 questions per survey)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</button>
          <button
            type="button"
            className="btn-secondary text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100"
            onClick={upgradeAllSurveysTo10Questions}
            disabled={upgrading}
          >
            {upgrading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Upgrade All to 10 Qs
          </button>
          <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Survey</button>
        </div>
      </div>

      {/* ── GLOBAL SURVEY REWARD COINS (MIN & MAX BULK SETTING) ── */}
      <div className="card p-5 border-2 border-primary-500/30 bg-gradient-to-r from-primary-50/40 via-white to-secondary-50/30 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-500 text-white flex items-center justify-center shadow-md shadow-primary-500/20 flex-shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-dark-900 flex items-center gap-2">
                All Surveys Reward Coins (Min & Max)
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Real-time Sync Active
                </span>
              </h2>
              <p className="text-xs text-dark-500 mt-0.5">
                Set Min and Max coins once for all surveys. Users will receive random reward coins within this range upon survey completion.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-dark-200 shadow-sm">
              <label className="text-xs font-bold text-dark-600">Min Coins:</label>
              <input
                type="number"
                min="1"
                value={globalMinReward}
                onChange={(e) => setGlobalMinReward(parseInt(e.target.value) || 1)}
                className="w-16 py-1 px-1.5 text-sm text-center font-bold text-dark-900 border border-dark-200 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-dark-200 shadow-sm">
              <label className="text-xs font-bold text-dark-600">Max Coins:</label>
              <input
                type="number"
                min="1"
                value={globalMaxReward}
                onChange={(e) => setGlobalMaxReward(parseInt(e.target.value) || 1)}
                className="w-16 py-1 px-1.5 text-sm text-center font-bold text-dark-900 border border-dark-200 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              type="button"
              disabled={savingBulkCoins}
              onClick={handleSaveBulkSurveyCoins}
              className="btn-primary py-2 px-4 text-xs font-bold whitespace-nowrap shadow-md shadow-primary-500/20 flex items-center gap-1.5"
            >
              {savingBulkCoins ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Apply to All Surveys Now
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input type="text" placeholder="Search by title, description..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="input pl-10" />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="input w-auto">
              <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }} className="input w-auto">
              <option value="createdAt_desc">Newest First</option><option value="createdAt_asc">Oldest First</option><option value="points_desc">Highest Points</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Survey</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Questions</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Created</th>
                <th className="w-32 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="flex items-center justify-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-primary-600" /><span className="text-dark-500">Loading surveys...</span></div></td></tr>
              ) : surveys.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">No surveys found</td></tr>
              ) : (
                surveys.map((survey) => (
                  <tr key={survey.id} className="hover:bg-dark-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900 truncate max-w-xs">{survey.title}</p>
                      <p className="text-sm text-dark-500 truncate max-w-xs">{survey.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-emerald-700 font-bold">
                        {survey.minReward && survey.maxReward
                          ? `${survey.minReward}-${survey.maxReward}`
                          : (globalMinReward && globalMaxReward ? `${globalMinReward}-${globalMaxReward}` : survey.points)}
                      </span>{' '}
                      <span className="text-xs text-dark-400">coins</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-dark-900 font-semibold">{survey.questions?.length || 0}</span>
                      {(survey.questions?.length || 0) < 10 ? (
                        <span className="ml-2 inline-block text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">Upgrade to 10</span>
                      ) : (
                        <span className="ml-2 inline-block text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">10 Qs ✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={'badge ' + (survey.isActive ? 'badge-success' : 'badge-neutral')}>{survey.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3 text-sm text-dark-500">{survey.createdAt?.toDate ? format(survey.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(survey)} className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Edit"><Edit className="w-5 h-5" /></button>
                        <button onClick={() => { if (confirm('Delete this survey?')) deleteMutation.mutate(survey.id); }} disabled={deleteMutation.isPending} className="p-2 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-200">
            <div className="text-sm text-dark-500">Page {currentPage} of {totalPages} ({totalCount || 0} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-900">{editingSurvey ? 'Edit Survey' : 'Create Survey'}</h2>
              <button onClick={closeModal} className="p-2 text-dark-400 hover:text-dark-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input name="title" type="text" defaultValue={editingSurvey?.title || ''} required className="input" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" rows={2} defaultValue={editingSurvey?.description || ''} className="input" />
              </div>
              <div>
                <label className="label">Points *</label>
                <input name="points" type="number" min="1" defaultValue={editingSurvey?.points || 10} required className="input" />
              </div>
              <div className="border-t border-dark-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-dark-900">Survey Questions ({questions.length}/10)</h3>
                  <span className="text-xs text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                    Required: 10 Questions
                  </span>
                </div>
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={i} className="border border-dark-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-dark-900">Question {i + 1}</h4>
                        {questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                      <input name={'q_' + i + '_text'} type="text" placeholder="Question text" defaultValue={q.question || ''} required className="input" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name={'q_' + i + '_o0'} type="text" placeholder="Option A" defaultValue={q.options?.[0] || ''} className="input" />
                        <input name={'q_' + i + '_o1'} type="text" placeholder="Option B" defaultValue={q.options?.[1] || ''} className="input" />
                        <input name={'q_' + i + '_o2'} type="text" placeholder="Option C" defaultValue={q.options?.[2] || ''} className="input" />
                        <input name={'q_' + i + '_o3'} type="text" placeholder="Option D" defaultValue={q.options?.[3] || ''} className="input" />
                      </div>
                    </div>
                  ))}
                </div>
                {questions.length < 10 && (
                  <button type="button" onClick={addQuestion} className="btn-outline w-full mt-3"><Plus className="w-4 h-4 mr-2" />Add Question</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input id="isActive" name="isActive" type="checkbox" defaultChecked={editingSurvey?.isActive !== false} className="w-4 h-4 text-primary-600 rounded border-dark-300" />
                <label htmlFor="isActive" className="text-sm text-dark-700">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : (editingSurvey ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
