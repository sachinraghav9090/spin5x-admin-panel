import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../firebase/config.jsx';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs,
  getCountFromServer,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

export default function Surveys() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const queryClient = useQueryClient();

  const buildQuery = (cursor = null) => {
    let q = collection(db, 'Surveys');
    const constraints = [orderBy(sortBy.split('_')[0], sortBy.split('_')[1]), limit(ITEMS_PER_PAGE)];
    
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    
    if (statusFilter === 'active') {
      constraints.unshift(where('isActive', '==', true));
    } else if (statusFilter === 'inactive') {
      constraints.unshift(where('isActive', '==', false));
    }
    
    return query(q, ...constraints);
  };

  const { data: surveysData, isLoading, refetch } = useQuery({
    queryKey: ['surveys', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Surveys'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(survey => 
            survey.title?.toLowerCase().includes(search.toLowerCase()) ||
            survey.description?.toLowerCase().includes(search.toLowerCase())
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      
      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const surveys = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newLastDoc = snap.docs[snap.docs.length - 1];
      setLastDoc(newLastDoc);
      return surveys;
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['surveysCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      let q = collection(db, 'Surveys');
      const constraints = [];
      if (statusFilter === 'active') {
        constraints.push(where('isActive', '==', true));
      } else if (statusFilter === 'inactive') {
        constraints.push(where('isActive', '==', false));
      }
      const snap = await getCountFromServer(query(q, ...constraints));
      return snap.data().count;
    },
  });

  const surveyMutation = useMutation({
    mutationFn: async ({ survey, isEdit }) => {
      const data = {
        ...survey,
        updatedAt: Timestamp.now(),
      };
      delete data.id;
      
      if (isEdit) {
        await updateDoc(doc(db, 'Surveys', editingSurvey.id), data);
      } else {
        data.createdAt = Timestamp.now();
        await addDoc(collection(db, 'Surveys'), data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success(editingSurvey ? 'Survey updated' : 'Survey created');
      setShowCreateModal(false);
      setEditingSurvey(null);
    },
    onError: () => toast.error(editingSurvey ? 'Failed to update survey' : 'Failed to create survey'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await deleteDoc(doc(db, 'Surveys', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Survey deleted');
    },
    onError: () => toast.error('Failed to delete survey'),
  });

  const surveys = surveysData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const questions = [];
    
    for (let i = 0; i < 10; i++) {
      const question = formData.get('question_' + i + '_text');
      if (question) {
        const options = [];
        for (let j = 0; j < 4; j++) {
          const opt = formData.get('question_' + i + '_option_' + j);
          if (opt) options.push(opt);
        }
        questions.push({ question, options });
      }
    }
    
    const survey = {
      title: formData.get('title'),
      description: formData.get('description'),
      points: parseInt(formData.get('points') || '10'),
      questions,
      isActive: formData.get('isActive') === 'on',
    };
    surveyMutation.mutate({ survey, isEdit: !!editingSurvey });
  };

  const handleEdit = (survey) => {
    setEditingSurvey(survey);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this survey?')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        
          <h1 className="text-2xl font-bold text-dark-900">Surveys Management</h1>
          <p className="text-dark-500 mt-1">Create and manage surveys for users</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
<button className="btn-primary" onClick={() => { setEditingSurvey(null); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Survey
          </button>
        </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search by title, description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="points_desc">Highest Points</option>
              <option value="points_asc">Lowest Points</option>
              <option value="title_asc">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
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
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading surveys...</span>
                    </div>
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-dark-500">
                    No surveys found
                  </td>
                </tr>
              ) : (
                surveys.map((survey) => (
                  <tr key={survey.id} className="hover:bg-dark-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900 truncate max-w-xs">{survey.title}</p>
                      <p className="text-sm text-dark-500 truncate max-w-xs">{survey.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-dark-900">{survey.points}</span>
                        <span className="text-xs text-dark-400">pts</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-dark-900">{survey.questions?.length || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={'badge ' + (survey.isActive ? 'badge-success' : 'badge-neutral')}>
                        {survey.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-500">
                      {survey.createdAt?.toDate ? format(survey.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(survey)}
                          className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(survey.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
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
            <div className="text-sm text-dark-500">
              Page {currentPage} of {totalPages} ({totalCount || 0} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {(showCreateModal || editingSurvey) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreateModal(false); setEditingSurvey(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-900">{editingSurvey ? 'Edit Survey' : 'Create Survey'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditingSurvey(null); }} className="p-2 text-dark-400 hover:text-dark-600">×</button>
            </div>
<form onSubmit={handleSubmit} className="p-6 space-y-4">
               
                <label htmlFor="title" className="label">Title *</label>
                <input id="title" name="title" type="text" defaultValue={editingSurvey?.title || ''} required className="input" />
               
                <label htmlFor="description" className="label">Description</label>
                <textarea id="description" name="description" rows={3} defaultValue={editingSurvey?.description || ''} className="input" />
               
                <label htmlFor="points" className="label">Points *</label>
                <input id="points" name="points" type="number" min="1" defaultValue={editingSurvey?.points || 10} required className="input" />
               
              <div className="border-t border-dark-200 pt-4">
                <h3 className="font-semibold text-dark-900 mb-3">Questions (minimum 1, max 10)</h3>
                <div className="space-y-3" id="questions-container">
                  {(editingSurvey?.questions || [{ question: '', options: ['', '', '', ''] }]).map((q, i) => (
                    <div key={i} className="border border-dark-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-dark-900">Question {i + 1}</h4>
                        {i > 0 && (
                          <button type="button" onClick={() => { /* remove question */ }} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
</div>
                      
                      <div>
                        <label className="label">Question Text *</label>
                        <input name={'question_' + i + '_text'} type="text" defaultValue={q.question || ''} required className="input" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name={'question_' + i + '_option_0'} type="text" placeholder="Option A" defaultValue={q.options?.[0] || ''} className="input" />
                        <input name={'question_' + i + '_option_1'} type="text" placeholder="Option B" defaultValue={q.options?.[1] || ''} className="input" />
                        <input name={'question_' + i + '_option_2'} type="text" placeholder="Option C" defaultValue={q.options?.[2] || ''} className="input" />
                        <input name={'question_' + i + '_option_3'} type="text" placeholder="Option D" defaultValue={q.options?.[3] || ''} className="input" />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => { /* add question */ }} className="btn-outline w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <input id="isActive" name="isActive" type="checkbox" defaultChecked={editingSurvey?.isActive !== false} className="w-4 h-4 text-primary-600 rounded border-dark-300" />
                <label htmlFor="isActive" className="text-sm text-dark-700">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowCreateModal(false); setEditingSurvey(null); }} className="btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={surveyMutation.isPending}>
                  {surveyMutation.isPending ? 'Saving...' : (editingSurvey ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
