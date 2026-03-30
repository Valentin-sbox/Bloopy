import { TextNode, $applyNodeReplacement } from 'lexical';
import { addClassNamesToElement } from '@lexical/utils';

/**
 * Nodo para texto resaltado (highlight)
 */
export class HighlightNode extends TextNode {
  static getType() {
    return 'highlight';
  }

  static clone(node) {
    return new HighlightNode(node.__text, node.__color, node.__key);
  }

  constructor(text, color, key) {
    super(text, key);
    this.__color = color || '#ffeb3b';
  }

  createDOM(config) {
    const element = super.createDOM(config);
    element.style.backgroundColor = this.__color;
    element.style.padding = '2px 4px';
    element.style.borderRadius = '4px';
    element.style.color = 'inherit';
    addClassNamesToElement(element, config.theme.highlight);
    return element;
  }

  updateDOM(prevNode, dom, config) {
    const isUpdated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__color !== this.__color) {
      dom.style.backgroundColor = this.__color;
    }
    return isUpdated;
  }

  static importJSON(serializedNode) {
    const node = $createHighlightNode(serializedNode.text, serializedNode.color);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      color: this.__color,
      type: 'highlight',
      version: 1,
    };
  }

  getColor() {
    return this.__color;
  }

  setColor(color) {
    const writable = this.getWritable();
    writable.__color = color;
  }
}

export function $createHighlightNode(text, color) {
  return $applyNodeReplacement(new HighlightNode(text, color));
}

export function $isHighlightNode(node) {
  return node instanceof HighlightNode;
}
