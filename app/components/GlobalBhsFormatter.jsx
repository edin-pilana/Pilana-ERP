"use client";
import { useEffect } from 'react';
import { formatirajTekstBHS } from '../utils/dateHelpers';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);

function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    let cur = el;
    while (cur && cur.nodeType === 1) {
        if (SKIP_TAGS.has(cur.tagName)) return true;
        if (cur.hasAttribute && (cur.hasAttribute('data-no-bhs-format') || cur.isContentEditable)) return true;
        cur = cur.parentElement;
    }
    return false;
}

function formatTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    const val = node.nodeValue;
    if (!val || !/\d/.test(val)) return;
    if (node.__bhsLastVal === val) return;
    if (shouldSkipElement(node.parentElement)) return;

    const formatted = formatirajTekstBHS(val);
    if (formatted !== val) {
        node.__bhsLastVal = formatted;
        node.nodeValue = formatted;
    } else {
        node.__bhsLastVal = val;
    }
}

function walkAndFormat(root) {
    if (!root) return;
    if (root.nodeType === 3) {
        formatTextNode(root);
        return;
    }
    if (root.nodeType !== 1) return;
    if (shouldSkipElement(root)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
        formatTextNode(current);
        current = walker.nextNode();
    }
}

/**
 * Globalni BHS Formatter (post-hydration):
 * Osigurava da svaki prikazani datum (DD.MM.YYYY.) i svaka prikazana decimalna/jedinična cifra
 * (tačka za hiljade, zarez za decimale) u čitavoj aplikaciji prati jedinstveni BHS standard,
 * bez uticaja na input polja, matematičke kalkulacije ili bazu podataka.
 */
export default function GlobalBhsFormatter() {
    useEffect(() => {
        if (typeof document === 'undefined' || !document.body) return;

        walkAndFormat(document.body);

        let rafId = null;
        const pendingNodes = new Set();

        const flush = () => {
            rafId = null;
            pendingNodes.forEach((n) => {
                if (n.isConnected) walkAndFormat(n);
            });
            pendingNodes.clear();
        };

        const observer = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'characterData' && m.target) {
                    if (m.target.__bhsLastVal !== m.target.nodeValue) {
                        pendingNodes.add(m.target);
                    }
                } else if (m.type === 'childList' && m.addedNodes?.length) {
                    for (let j = 0; j < m.addedNodes.length; j++) {
                        pendingNodes.add(m.addedNodes[j]);
                    }
                }
            }
            if (pendingNodes.size > 0 && rafId === null) {
                rafId = window.requestAnimationFrame(flush);
            }
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
        });

        return () => {
            observer.disconnect();
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, []);

    return null;
}
