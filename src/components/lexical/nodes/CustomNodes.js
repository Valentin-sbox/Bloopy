/**
 * ============================================================================
 * CUSTOM NODES
 * ============================================================================
 * 
 * Nodos personalizados para Lexical
 * Extienden la funcionalidad del editor
 * ============================================================================
 */

import { TextNode, $applyNodeReplacement } from 'lexical';

// HighlightNode tiene su propia fuente de verdad en HighlightNode.js
export { HighlightNode, $createHighlightNode, $isHighlightNode } from './HighlightNode';

/**
 * Nodo para menciones (@usuario)
 */
export class MentionNode extends TextNode {
  __mention;

  static getType() {
    return 'mention';
  }

  static clone(node) {
    return $applyNodeReplacement(new MentionNode(node.__mention, node.__text, node.__key));
  }

  constructor(mentionName, text, key) {
    super(text || `@${mentionName}`, key);
    this.__mention = mentionName;
  }

  createDOM(config) {
    const element = super.createDOM(config);
    element.style.color = 'var(--accent-blue)';
    element.style.fontWeight = '600';
    element.style.cursor = 'pointer';
    element.className = 'editor-mention';
    element.setAttribute('data-mention', this.__mention);
    return element;
  }

  updateDOM(prevNode, dom, config) {
    return false;
  }

  static importJSON(serializedNode) {
    const node = $createMentionNode(serializedNode.mentionName);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention,
      type: 'mention',
      version: 1,
    };
  }

  getMentionName() {
    return this.__mention;
  }
}

export function $createMentionNode(mentionName) {
  return $applyNodeReplacement(new MentionNode(mentionName));
}

export function $isMentionNode(node) {
  return node instanceof MentionNode;
}

/**
 * Nodo para hashtags (#tema)
 */
export class HashtagNode extends TextNode {
  __tag;

  static getType() {
    return 'hashtag';
  }

  static clone(node) {
    return $applyNodeReplacement(new HashtagNode(node.__tag, node.__text, node.__key));
  }

  constructor(tag, text, key) {
    super(text || `#${tag}`, key);
    this.__tag = tag;
  }

  createDOM(config) {
    const element = super.createDOM(config);
    element.style.color = 'var(--accent-purple)';
    element.style.fontWeight = '500';
    element.style.cursor = 'pointer';
    element.className = 'editor-hashtag';
    element.setAttribute('data-tag', this.__tag);
    return element;
  }

  updateDOM(prevNode, dom, config) {
    return false;
  }

  static importJSON(serializedNode) {
    const node = $createHashtagNode(serializedNode.tag);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      tag: this.__tag,
      type: 'hashtag',
      version: 1,
    };
  }

  getTag() {
    return this.__tag;
  }
}

export function $createHashtagNode(tag) {
  return $applyNodeReplacement(new HashtagNode(tag));
}

export function $isHashtagNode(node) {
  return node instanceof HashtagNode;
}
