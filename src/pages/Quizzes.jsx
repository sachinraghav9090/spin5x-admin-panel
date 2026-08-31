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
  HelpCircle
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

export default function Quizzes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const queryClient = useQueryClient();

  const buildQuery = (cursor = null) => {
    let q = collection(db, 'Quizzes');
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

  const { data: quizzesData, isLoading, refetch } = useQuery({
    queryKey: ['quizzes', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Quizzes'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(quiz => 
            quiz.title?.toLowerCase().includes(search.toLowerCase()) ||
            quiz.description?.toLowerCase().includes(search.toLowerCase())
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      
      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const quizzes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newLastDoc = snap.docs[snap.docs.length - 1];
      setLastDoc(newLastDoc);
      return quizzes;
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['quizzesCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      let q = collection(db, 'Quizzes');
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

  const quizMutation = useMutation({
    mutationFn: async ({ quiz, isEdit }) => {
      const data = {
        ...quiz,
        updatedAt: Timestamp.now(),
      };
      delete data.id;
      
      if (isEdit) {
        await updateDoc(doc(db, 'Quizzes', editingQuiz.id), data);
      } else {
        data.createdAt = Timestamp.now();
        await addDoc(collection(db, 'Quizzes'), data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success(editingQuiz ? 'Quiz updated' : 'Quiz created');
      setShowCreateModal(false);
      setEditingQuiz(null);
    },
    onError: () => toast.error(editingQuiz ? 'Failed to update quiz' : 'Failed to create quiz'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await deleteDoc(doc(db, 'Quizzes', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz deleted');
    },
    onError: () => toast.error('Failed to delete quiz'),
  });

  const quizzes = quizzesData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'badge-success';
      case 'Medium': return 'badge-warning';
      case 'Hard': return 'badge-error';
      default: return 'badge-info';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const questions = [];
    
    for (let i = 0; i < 10; i++) {
      const text = formData.get('question_' + i + '_text');
      if (text) {
        const options = [];
        for (let j = 0; j < 4; j++) {
          const opt = formData.get('question_' + i + '_option_' + j);
          if (opt) options.push(opt);
        }
        const correctIndex = parseInt(formData.get('question_' + i + '_correct') || '0');
        const type = formData.get('question_' + i + '_type') || 'multiple_choice';
        questions.push({ text, options, correctIndex, type });
      }
    }
    
    const quiz = {
      title: formData.get('title'),
      description: formData.get('description'),
      difficulty: formData.get('difficulty'),
      points: parseInt(formData.get('points') || '10'),
      timeSeconds: parseInt(formData.get('timeSeconds') || '30'),
      questions,
      isActive: formData.get('isActive') === 'on',
      isAutoGenerated: false,
    };
    quizMutation.mutate({ quiz, isEdit: !!editingQuiz });
  };

  const handleEdit = (quiz) => {
    setEditingQuiz(quiz);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this quiz?')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-900">Quizzes Management</h1>
        <p className="text-dark-500 mt-1">Create and manage quizzes for users</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
        <button className="btn-primary" onClick={() => { setEditingQuiz(null); setShowCreateModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Quiz
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Quiz</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Difficulty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Questions</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Created</th>
                <th className="w-32 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading quizzes...</span>
                    </div>
                  </td>
                </tr>
              ) : quizzes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-dark-500">
                    No quizzes found
                  </td>
                </tr>
              ) : (
                quizzes.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-dark-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900 truncate max-w-xs">{quiz.title}</p>
                      <p className="text-sm text-dark-500 truncate max-w-xs">{quiz.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={'badge ' + getDifficultyColor(quiz.difficulty)}>{quiz.difficulty}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-dark-900">{quiz.points}</span>
                        <span className="text-xs text-dark-400">pts</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-dark-900">{quiz.questions?.length || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-dark-500">{Math.floor((quiz.timeSeconds || 30) / 60)}m {(quiz.timeSeconds || 30) % 60}s</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={quiz.isActive ? 'badge badge-success' : 'badge badge-neutral'}>
                        {quiz.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-500">
                      {quiz.createdAt?.toDate ? format(quiz.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(quiz)}
                          className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(quiz.id)}
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
      </div>

      {showCreateModal || editingQuiz ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreateModal(false); setEditingQuiz(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-900">{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditingQuiz(null); }} className="p-2 text-dark-400 hover:text-dark-600">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <label htmlFor="title" className="label">Title *</label>
              <input id="title" name="title" type="text" defaultValue={editingQuiz?.title || ''} required className="input" />
              
              <label htmlFor="description" className="label">Description</label>
              <textarea id="description" name="description" rows={3} defaultValue={editingQuiz?.description || ''} className="input" />
              <div className="grid grid-cols-3 gap-4">
                
                <label htmlFor="difficulty" className="label">Difficulty *</label>
                <select id="difficulty" name="difficulty" defaultValue={editingQuiz?.difficulty || 'Easy'} required className="input">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                
                <label htmlFor="points" className="label">Points *</label>
                <input id="points" name="points" type="number" min="1" defaultValue={editingQuiz?.points || 10} required className="input" />
                
                <label htmlFor="timeSeconds" className="label">Time (seconds) *</label>
                <input id="timeSeconds" name="timeSeconds" type="number" min="10" defaultValue={editingQuiz?.timeSeconds || 30} required className="input" />
            
            <div className="border-t border-dark-200 pt-4">
              <h3 className="font-semibold text-dark-900 mb-3">Questions (minimum 1, max 10)</h3>
              <div className="space-y-3" id="questions-container">
                {(editingQuiz?.questions || [{ text: '', options: ['', '', '', ''], correctIndex: 0, type: 'multiple_choice' }]).map((q, i) => (
                  <div key={i} className="border border-dark-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-dark-900">Question {i + 1}</h4>
                      {i > 0 && (
                        <button type="button" onClick={() => { /* remove question */ }} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <label className="label">Question Text *</label>
                    <input name={'question_' + i + '_text'} type="text" defaultValue={q.text || ''} required className="input" />
                    <div className="grid grid-cols-2 gap-2">
                      <input name={'question_' + i + '_option_0'} type="text" placeholder="Option A" defaultValue={q.options?.[0] || ''} className="input" />
                      <input name={'question_' + i + '_option_1'} type="text" placeholder="Option B" defaultValue={q.options?.[1] || ''} className="input" />
                      <input name={'question_' + i + '_option_2'} type="text" placeholder="Option C" defaultValue={q.options?.[2] || ''} className="input" />
                      <input name={'question_' + i + '_option_3'} type="text" placeholder="Option D" defaultValue={q.options?.[3] || ''} className="input" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select name={'question_' + i + '_correct'} defaultValue={q.correctIndex || 0} className="input">
                        <option value="0">A (Correct)</option>
                        <option value="1">B (Correct)</option>
                        <option value="2">C (Correct)</option>
                        <option value="3">D (Correct)</option>
                      </select>
                      <select name={'question_' + i + '_type'} defaultValue={q.type || 'multiple_choice'} className="input">
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { /* add question */ }} className="btn-outline w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </button>
            
            <div className="flex items-center gap-2">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={editingQuiz?.isActive !== false} className="w-4 h-4 text-primary-600 rounded border-dark-300" />
              <label htmlFor="isActive" className="text-sm text-dark-700">Active</label>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => { setShowCreateModal(false); setEditingQuiz(null); }} className="btn-outline flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={quizMutation.isPending}>
                {quizMutation.isPending ? 'Saving...' : (editingQuiz ? 'Update' : 'Create')}
              </button>
</div>
            </div>
            </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}