import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../firebase/config.js';
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
  Timestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

export default function Tasks() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isSpecial, setIsSpecial] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasksData, isLoading, refetch } = useQuery({
    queryKey: ['tasks', search, statusFilter, typeFilter, sortBy, currentPage],
    queryFn: async () => {
      const col = collection(db, 'Tasks');
      const [field, dir] = sortBy.split('_');
      const constraints = [orderBy(field, dir), limit(300)];
      
      const snap = await getDocs(query(col, ...constraints));
      let allTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (search) {
        const s = search.toLowerCase();
        allTasks = allTasks.filter(
          (t) =>
            t.title?.toLowerCase().includes(s) ||
            t.description?.toLowerCase().includes(s) ||
            t.category?.toLowerCase().includes(s) ||
            t.targetUrl?.toLowerCase().includes(s)
        );
      }

      if (statusFilter === 'active') {
        allTasks = allTasks.filter((t) => t.isActive === true);
      } else if (statusFilter === 'inactive') {
        allTasks = allTasks.filter((t) => t.isActive === false);
      }

      if (typeFilter === 'special') {
        allTasks = allTasks.filter((t) => t.isSpecialTask === true || (t.targetUrl && t.targetUrl.length > 0));
      } else if (typeFilter === 'standard') {
        allTasks = allTasks.filter((t) => !t.isSpecialTask && (!t.targetUrl || t.targetUrl.length === 0));
      }

      return allTasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    },
    placeholderData: (prev) => prev,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['tasksCount', statusFilter, typeFilter, search],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'Tasks'));
      let all = snap.docs.map((d) => d.data());
      if (statusFilter === 'active') all = all.filter((t) => t.isActive === true);
      if (statusFilter === 'inactive') all = all.filter((t) => t.isActive === false);
      if (typeFilter === 'special') all = all.filter((t) => t.isSpecialTask === true || (t.targetUrl && t.targetUrl.length > 0));
      if (typeFilter === 'standard') all = all.filter((t) => !t.isSpecialTask && (!t.targetUrl || t.targetUrl.length === 0));
      return all.length;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ task, isEdit }) => {
      const data = { ...task, updatedAt: Timestamp.now() };
      delete data.id;
      if (isEdit) {
        await updateDoc(doc(db, 'Tasks', editingTask.id), data);
      } else {
        data.createdAt = Timestamp.now();
        await addDoc(collection(db, 'Tasks'), data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(editingTask ? 'Task updated successfully' : 'Task created successfully');
      setShowModal(false);
      setEditingTask(null);
    },
    onError: () => toast.error('Failed to save task'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await deleteDoc(doc(db, 'Tasks', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const handleOpenModal = (task = null) => {
    setEditingTask(task);
    setIsSpecial(task ? (task.isSpecialTask === true || task.category === 'App Install' || !!task.targetUrl) : false);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetUrl = fd.get('targetUrl')?.toString().trim() || '';
    const category = isSpecial ? 'App Install' : (fd.get('category') || 'General');
    const task = {
      title: fd.get('title'),
      description: fd.get('description'),
      category,
      points: parseInt(fd.get('points') || '0'),
      dailyLimit: parseInt(fd.get('dailyLimit') || '1'),
      isActive: fd.get('isActive') === 'on',
      isSpecialTask: isSpecial,
      targetUrl: isSpecial ? targetUrl : null,
      isAutoGenerated: false,
    };
    saveMutation.mutate({ task, isEdit: !!editingTask });
  };

  const tasks = tasksData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Tasks Management</h1>
          <p className="text-dark-500 mt-1">Create regular and Special URL/App tasks with custom coin rewards</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </button>
          <button className="btn-primary" onClick={() => handleOpenModal(null)}>
            <Plus className="w-4 h-4 mr-2" />Add Task
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search by title, category, URL..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="input w-auto font-medium"
            >
              <option value="all">All Types</option>
              <option value="special">⭐ Special Tasks Only</option>
              <option value="standard">Standard Tasks</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="all">All Status</option>
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
              <option value="points_desc">Highest Coins</option>
              <option value="points_asc">Lowest Coins</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Task Details</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Type / URL</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Reward Coins</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Daily Limit</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Created</th>
                <th className="w-28 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading tasks...</span>
                    </div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-dark-500">No tasks found</td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isSpec = task.isSpecialTask || (task.targetUrl && task.targetUrl.length > 0);
                  return (
                    <tr key={task.id} className="hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isSpec && <span className="text-amber-500 font-bold" title="Special Task">⭐</span>}
                          <div>
                            <p className="font-semibold text-dark-900 truncate max-w-xs">{task.title}</p>
                            <p className="text-xs text-dark-500 truncate max-w-xs">{task.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSpec ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Special Task
                            </span>
                            {task.targetUrl && (
                              <a
                                href={task.targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary-600 hover:text-primary-700 p-1"
                                title={task.targetUrl}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-dark-400">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge badge-info">{task.category || 'General'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-emerald-600">+{task.points}</span>
                        <span className="text-xs text-dark-400 ml-1">coins</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-dark-900">{task.dailyLimit || 1}/day</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={'badge ' + (task.isActive ? 'badge-success' : 'badge-neutral')}>
                          {task.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark-500">
                        {task.createdAt?.toDate ? format(task.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(task)}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this task?')) deleteMutation.mutate(task.id);
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setShowModal(false); setEditingTask(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-dark-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                <h2 className="text-xl font-bold text-dark-900">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h2>
              </div>
              <button onClick={() => { setShowModal(false); setEditingTask(null); }} className="p-2 text-dark-400 hover:text-dark-600">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Special Task Toggle */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <span>⭐ Special Task (App Install / URL Task)</span>
                  </p>
                  <p className="text-xs text-amber-700">Open external app, website, YouTube, Telegram, etc.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isSpecial}
                  onChange={(e) => setIsSpecial(e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded border-amber-300 cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="title" className="label">Task Title *</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={editingTask?.title || ''}
                  required
                  className="input"
                  placeholder="e.g. Install & Register on XYZ App"
                />
              </div>

              {/* Target URL if Special Task */}
              {isSpecial && (
                <div className="animate-fade-in">
                  <label htmlFor="targetUrl" className="label text-amber-900 font-semibold flex items-center gap-1">
                    <LinkIcon className="w-4 h-4 text-amber-600" />
                    Target URL / App Link *
                  </label>
                  <input
                    id="targetUrl"
                    name="targetUrl"
                    type="url"
                    defaultValue={editingTask?.targetUrl || ''}
                    required={isSpecial}
                    className="input border-amber-300 focus:border-amber-500"
                    placeholder="https://play.google.com/store/apps/details?id=... or https://..."
                  />
                  <p className="text-xs text-dark-400 mt-1">User app will open this URL when they start the special task.</p>
                </div>
              )}

              <div>
                <label htmlFor="description" className="label">Task Description / Instructions</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={editingTask?.description || ''}
                  className="input"
                  placeholder="Explain instructions to user: download app, register, visit site, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="label">Category *</label>
                  {isSpecial ? (
                    <div>
                      <input
                        id="category"
                        name="category"
                        type="text"
                        value="App Install"
                        readOnly
                        className="input bg-dark-50 font-semibold text-emerald-700 border-emerald-300 cursor-not-allowed"
                      />
                      <p className="text-[11px] text-emerald-600 mt-1 font-medium">⭐ Special tasks category is strictly "App Install" only.</p>
                    </div>
                  ) : (
                    <select
                      id="category"
                      name="category"
                      defaultValue={editingTask?.category || 'General'}
                      className="input"
                      required
                    >
                      <option value="General">General</option>
                      <option value="Social">Social Media</option>
                      <option value="Survey">Survey</option>
                      <option value="Engagement">Engagement</option>
                      <option value="Promotional">Promotional</option>
                    </select>
                  )}
                </div>
                <div>
                  <label htmlFor="points" className="label">Reward Coins *</label>
                  <input
                    id="points"
                    name="points"
                    type="number"
                    min="1"
                    defaultValue={editingTask?.points || 50}
                    required
                    className="input font-semibold text-emerald-600"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dailyLimit" className="label">Daily Limit *</label>
                  <input
                    id="dailyLimit"
                    name="dailyLimit"
                    type="number"
                    min="1"
                    defaultValue={editingTask?.dailyLimit || 1}
                    required
                    className="input"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    defaultChecked={editingTask?.isActive !== false}
                    className="w-4 h-4 text-primary-600 rounded border-dark-300"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-dark-700">Active Task</label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingTask(null); }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
