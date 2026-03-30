/**
 * ============================================================================
 * LINK MODAL COMPONENT
 * ============================================================================
 * 
 * Modal para insertar/editar enlaces en el editor
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';

const LinkModal = ({ isOpen, onClose, onInsert, initialUrl = '', initialText = '' }) => {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setText(initialText);
    }
  }, [isOpen, initialUrl, initialText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onInsert(url.trim(), text.trim());
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Insertar enlace"
      size="small"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ejemplo.com"
            autoFocus
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
            Texto (opcional)
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto del enlace"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              fontWeight: 500
            }}
          >
            Insertar
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default LinkModal;
