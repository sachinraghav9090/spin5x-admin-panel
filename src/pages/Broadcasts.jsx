import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, RefreshCw, Megaphone, Eye, EyeOff, Loader2, Save, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { db } from '../firebase/config.js';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Broadcasts() {
  const [showForm, setShowForm] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState(null);
  const queryClient = useQueryClient();

  const { data: broadcasts = [], isLoading, refetch } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'Broadcasts'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await deleteDoc(doc(db, 'Broadcasts', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast deleted');
    },
    onError: () => toast.error('Failed to delete broadcast'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      await updateDoc(doc(db, 'Broadcasts', id), { isActive: !isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast updated');
    },
  });

  const openEdit = (b) => {
    setEditingBroadcast(b);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingBroadcast(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Broadcasts</h1>
          <p className="text-dark-500 mt-1">Send popup notices & announcements to all users</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</button>
          <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Broadcast</button>
        </div>
      </div>

      {showForm && (
        <BroadcastForm
          broadcast={editingBroadcast}
          onClose={() => { setShowForm(false); setEditingBroadcast(null); }}
          onSaved={() => { setShowForm(false); setEditingBroadcast(null); queryClient.invalidateQueries({ queryKey: ['broadcasts'] }); }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-50 border-b border-dark-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Broadcast</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
              <th className="w-40 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" /></td></tr>
            ) : broadcasts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-dark-500">No broadcasts yet. Create one to send a popup to all users.</td></tr>
            ) : (
              broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-dark-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-dark-900">{b.title || 'Untitled'}</p>
                    <p className="text-sm text-dark-500 truncate max-w-md">{b.message || ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.type === 'popup' ? 'bg-purple-100 text-purple-700' : b.type === 'banner' ? 'bg-blue-100 text-blue-700' : 'bg-dark-100 text-dark-600'}`}>{b.type || 'popup'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-500">
                    {b.createdAt?.toDate
                      ? format(b.createdAt.toDate(), 'MMM dd, yyyy HH:mm')
                      : b.createdAt?.seconds
                        ? format(new Date(b.createdAt.seconds * 1000), 'MMM dd, yyyy HH:mm')
                        : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-dark-100 text-dark-500'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleMutation.mutate({ id: b.id, isActive: b.isActive })} className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title={b.isActive ? 'Deactivate' : 'Activate'}>
                        {b.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-dark-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this broadcast?')) deleteMutation.mutate(b.id); }} className="p-2 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BroadcastForm({ broadcast, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      title: fd.get('title')?.trim() || '',
      message: fd.get('message')?.trim() || '',
      type: fd.get('type') || 'popup',
      buttonText: fd.get('buttonText')?.trim() || 'OK',
      buttonUrl: fd.get('buttonUrl')?.trim() || '',
      isActive: fd.get('isActive') === 'on',
      priority: fd.get('priority') || 'normal',
    };

    try {
      if (broadcast?.id) {
        await updateDoc(doc(db, 'Broadcasts', broadcast.id), { ...data, updatedAt: Timestamp.now() });
        toast.success('Broadcast updated');
      } else {
        await addDoc(collection(db, 'Broadcasts'), { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        toast.success('Broadcast created');
      }
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save broadcast');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 border-2 border-primary-200 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-dark-900 flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary-600" />{broadcast ? 'Edit Broadcast' : 'New Broadcast'}</h2>
        <button onClick={onClose} className="p-2 rounded-lg text-dark-400 hover:text-dark-700 hover:bg-dark-100"><X className="w-5 h-5" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Title *</label>
            <input name="title" type="text" required defaultValue={broadcast?.title || ''} className="input" placeholder="e.g. 🎉 Big Update!" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" defaultValue={broadcast?.type || 'popup'} className="input">
              <option value="popup">Popup Dialog</option>
              <option value="banner">Bottom Banner</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Message *</label>
          <textarea name="message" rows={3} required defaultValue={broadcast?.message || ''} className="input" placeholder="Write your announcement message here..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Button Text</label>
            <input name="buttonText" type="text" defaultValue={broadcast?.buttonText || 'OK'} className="input" placeholder="e.g. OK, Learn More" />
          </div>
          <div>
            <label className="label">Button URL (optional)</label>
            <input name="buttonUrl" type="text" defaultValue={broadcast?.buttonUrl || ''} className="input" placeholder="e.g. https://example.com" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" defaultValue={broadcast?.priority || 'normal'} className="input">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High (non-dismissable)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input name="isActive" type="checkbox" id="isActiveCb" defaultChecked={broadcast?.isActive ?? true} />
          <label htmlFor="isActiveCb" className="text-sm text-dark-700 font-medium">Active (visible to users)</label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1" disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : broadcast ? 'Update Broadcast' : 'Create Broadcast'}</button>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
