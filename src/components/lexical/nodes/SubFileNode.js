import React from 'react';
import { DecoratorNode, $applyNodeReplacement } from 'lexical';
import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
import { getIconById, DEFAULT_FILE_ICON } from '../../../utils/iconLibrary';

/**
 * Componente React para renderizar el nodo SubFile dentro del editor
 */
const SubFileComponent = ({ data, nodeKey }) => {
  if (!data || !data.name) return null;
  
  const iconId = data.customIcon;
  const iconData = iconId ? getIconById(iconId) : DEFAULT_FILE_ICON;
  const lastUpdate = data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : 'Reciente';

  return (
    <div 
      className="lexical-subfile-card in-editor"
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-lexical-subfile-key', nodeKey);
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging');
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new CustomEvent('open-subfile', { detail: data });
        window.dispatchEvent(event);
      }}
    >
      <div
        className="lexical-subfile-drag-handle"
      >
        <Icon path={mdi.mdiDragVertical} size={0.7} />
      </div>
      <div className="lexical-subfile-icon">
        <Icon path={iconData.icon} size={0.9} color={iconData.color || 'var(--accent-primary)'} />
      </div>
      <div className="lexical-subfile-info">
        <span className="lexical-subfile-name">{data.name.replace(/\.(txt|canvas)$/i, '')}</span>
        <span className="lexical-subfile-meta">{lastUpdate} • {data.lastCharCount || 0} caracteres</span>
      </div>
      <Icon path={mdi.mdiChevronRight} size={0.8} color="var(--text-tertiary)" />
    </div>
  );
};

/**
 * Nodo personalizado para representar Subarchivos integrados en el editor Lexical
 */
export class SubFileNode extends DecoratorNode {
  static getType() {
    return 'subfile';
  }

  static clone(node) {
    return new SubFileNode(node.__data, node.__key);
  }

  constructor(data, key) {
    super(key);
    this.__data = data || {};
  }

  setData(data) {
    const self = this.getWritable();
    self.__data = data;
  }

  getData() {
    return this.__data;
  }

  createDOM() {
    const div = document.createElement('div');
    div.style.display = 'block';
    div.className = 'lexical-subfile-node-container';
    return div;
  }

  updateDOM() {
    return false;
  }

  static importJSON(serializedNode) {
    return $createSubFileNode(serializedNode.data);
  }

  exportJSON() {
    return {
      data: this.__data,
      type: 'subfile',
      version: 1,
    };
  }

  exportDOM() {
    const element = document.createElement('div');
    element.setAttribute('data-lexical-subfile', JSON.stringify(this.__data));
    element.style.padding = '10px';
    element.style.border = '1px solid #333';
    element.style.borderRadius = '8px';
    element.style.margin = '10px 0';
    element.textContent = `Archivo: ${this.__data.name}`;
    return { element };
  }

  static importDOM() {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-subfile')) {
          return null;
        }
        return {
          conversion: (domNode) => {
            try {
              const data = JSON.parse(domNode.getAttribute('data-lexical-subfile'));
              return { node: $createSubFileNode(data) };
            } catch (e) {
              return null;
            }
          },
          priority: 1,
        };
      },
    };
  }

  decorate() {
    return (
      <SubFileComponent data={this.__data} nodeKey={this.getKey()} />
    );
  }
}

export function $createSubFileNode(data) {
  return $applyNodeReplacement(new SubFileNode(data));
}

export function $isSubFileNode(node) {
  return node instanceof SubFileNode;
}
