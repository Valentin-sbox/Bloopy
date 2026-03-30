/**
 * COMMENTSSIDEBAR.JS
 * COMPONENTE: PANEL DE COMENTARIOS
 */

import React, { useState } from 'react';
import { escapeHtml } from '../utils/helpers';
import { useTranslation } from '../utils/i18n';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { mdiCommentMultiple, mdiClose, mdiCommentProcessing, mdiTrashCan, mdiSend } = mdi;

function CommentsSidebar({ comments = [], fileName, onClose, onAddComment, onDeleteComment, isSplitView = false }) {
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  return (
    <>
      <aside className="comments-sidebar">
        <div className="comments-header">
          <h3><Icon path={mdiCommentMultiple} size={0.8} /> {t('comments.title')}</h3>
          <button className="close-btn" onClick={onClose}>
            <Icon path={mdiClose} size={0.7} />
          </button>
        </div>

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">
              <div className="no-comments-icon">
                <Icon path={mdiCommentProcessing} size={1.5} />
              </div>
              <p>{t('comments.noComments')}</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment-card">
                <div className="comment-card-header">
                  <div className="comment-user-info">
                    <div className="comment-avatar">
                      {comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="comment-meta-info">
                      <span className="comment-author-name">{escapeHtml(comment.author)}</span>
                      <span className="comment-timestamp">
                        {new Date(comment.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="comment-action-btn delete"
                    onClick={() => onDeleteComment(comment.id)}
                    title={t('comments.delete')}
                  >
                    <Icon path={mdiTrashCan} size={0.6} />
                  </button>
                </div>
                <div className="comment-card-body">
                  <p className="comment-text-content">{escapeHtml(comment.text)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="comment-input-area">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit(e);
              }}
            />
            <button type="submit" className="btns" title={t('comments.send')}>
              <Icon path={mdiSend} size={0.5} />
            </button>
          </form>
        </div>
      </aside>

      <div className="comments-overlay" onClick={onClose}></div>
    </>
  );
}

export default CommentsSidebar;
