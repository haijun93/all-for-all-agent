import React, { useState, useCallback } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Monitor } from 'lucide-react';

interface SubdirInfo {
  name: string;
  path: string;
  has_children: boolean;
}

interface FolderTreeProps {
  /** Top-level indexed folder paths — the tree's root nodes, like the
   * drives/watched locations under "내 컴퓨터" in Picasa 3's tree view. */
  rootFolders: string[];
  activeCategory: string;
  selectedId: string | null;
  onSelectFolder: (path: string) => void;
  onOpenInExplorer?: (path: string) => void;
}

interface NodeState {
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
  children: SubdirInfo[];
}

/**
 * Windows-Explorer-style lazy folder tree: each node fetches its own
 * children only when first expanded (list_subdirectories, a single shallow
 * readdir), rather than walking and holding the whole subtree in memory
 * upfront. Mirrors Picasa 3's left-hand "내 컴퓨터" tree view.
 */
export const FolderTree: React.FC<FolderTreeProps> = ({
  rootFolders,
  activeCategory,
  selectedId,
  onSelectFolder,
  onOpenInExplorer,
}) => {
  const [nodeState, setNodeState] = useState<Map<string, NodeState>>(new Map());

  const getState = (path: string): NodeState =>
    nodeState.get(path) || { expanded: false, loaded: false, loading: false, children: [] };

  const setState = (path: string, patch: Partial<NodeState>) => {
    setNodeState((prev) => {
      const next = new Map(prev);
      next.set(path, { ...getState(path), ...patch });
      return next;
    });
  };

  const toggleExpand = useCallback(
    async (path: string) => {
      const state = getState(path);
      if (!state.expanded && !state.loaded && isTauri()) {
        setState(path, { loading: true, expanded: true });
        try {
          const children = await invoke<SubdirInfo[]>('list_subdirectories', { path });
          setState(path, { children, loaded: true, loading: false });
        } catch (e) {
          console.warn('[FolderTree] Failed to list subdirectories:', path, e);
          setState(path, { loading: false, loaded: true, children: [] });
        }
      } else {
        setState(path, { expanded: !state.expanded });
      }
    },
    [nodeState]
  );

  const renderNode = (name: string, path: string, hasChildrenHint: boolean, depth: number) => {
    const state = getState(path);
    const isActive = activeCategory === 'folder' && selectedId === path;

    return (
      <div key={path}>
        <div
          className={`folder-tree-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => onSelectFolder(path)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onOpenInExplorer?.(path);
          }}
          title={`${path}${onOpenInExplorer ? '\n더블클릭: 파일 탐색기에서 열기' : ''}`}
        >
          <span
            className="folder-tree-twisty"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(path);
            }}
          >
            {hasChildrenHint ? (
              state.expanded ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )
            ) : (
              <span style={{ display: 'inline-block', width: 13 }} />
            )}
          </span>
          {isActive ? (
            <FolderOpen size={14} color="#fbbc05" />
          ) : (
            <Folder size={14} color="#fbbc05" />
          )}
          <span className="folder-tree-label" title={name}>
            {name}
          </span>
        </div>

        {state.expanded && (
          <div>
            {state.loading && (
              <div className="folder-tree-row" style={{ paddingLeft: 10 + (depth + 1) * 16, opacity: 0.6 }}>
                <span style={{ width: 13, display: 'inline-block' }} />
                <span style={{ fontSize: '0.76rem' }}>불러오는 중...</span>
              </div>
            )}
            {!state.loading &&
              state.children.map((child) =>
                renderNode(child.name, child.path, child.has_children, depth + 1)
              )}
          </div>
        )}
      </div>
    );
  };

  if (rootFolders.length === 0) {
    return null;
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree-row folder-tree-computer" style={{ paddingLeft: 10 }}>
        <span style={{ width: 13, display: 'inline-block' }} />
        <Monitor size={14} color="#94a3b8" />
        <span className="folder-tree-label">내 컴퓨터</span>
      </div>
      {rootFolders.map((folder) => {
        const name = folder.split(/[\\/]/).filter(Boolean).pop() || folder;
        return renderNode(name, folder, true, 1);
      })}
    </div>
  );
};
