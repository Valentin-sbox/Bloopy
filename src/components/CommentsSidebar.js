/**
 * BLOCK GUARD v4.0.0 - COMMENTSSIDEBAR.JS
 * COMPONENTE: PANEL DE COMENTARIOS
 */

import React, { useState } from 'react';
import { escapeHtml } from '../utils/helpers';
import { useTranslation } from '../utils/i18n';

function CommentsSidebar({ comments = [], activeParagraphId, fileName, onClose, onAddComment, onDeleteComment }) {
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
          <h3><i className="fas fa-comments"></i> {t('comments.title')}</h3>
          {fileName && <span className="comments-file-name">{fileName}</span>}
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">
              <i className="fas fa-comment-slash"></i>
              <p>{t('comments.noComments')}</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <span className="comment-author">
                    <i className="fas fa-user-circle"></i>
                    {escapeHtml(comment.author)}
                  </span>
                  <span className="comment-date">
                    {new Date(comment.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="comment-text">{escapeHtml(comment.text)}</p>
                <button
                  className="delete-comment-btn"
                  onClick={() => onDeleteComment(comment.id)}
                >
                  <i className="fas fa-trash"></i> {t('comments.delete')}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="comment-input-area">
          <form onSubmit={handleSubmit}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.placeholder')}
              rows={3}
            />
            <button type="submit" className="btn-primary">
              <i className="fas fa-paper-plane"></i> {t('comments.send')}
            </button>
          </form>
        </div>
      </aside>

      <div className="comments-overlay" onClick={onClose}></div>
    </>
  );
}

export default CommentsSidebar;
