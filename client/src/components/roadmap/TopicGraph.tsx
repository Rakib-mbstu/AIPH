import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Node, Edge } from '@xyflow/react'
import { Legend } from './Legend'
import { nodeTypes } from './TopicNode'

interface TopicGraphProps {
  nodes: Node[]
  edges: Edge[]
}

export function TopicGraph({ nodes, edges }: TopicGraphProps) {
  return (
    <section>
      <div className="flex items-center gap-4 text-xs mb-3">
        <Legend color="bg-emerald-500" label="Mastered" />
        <Legend color="bg-indigo-500"  label="In progress" />
        <Legend color="bg-sky-400"     label="Available" />
        <Legend color="bg-gray-300"    label="Locked" />
        <Legend color="bg-rose-500"    label="Weak area" ring />
      </div>

      <div
        className="border border-gray-200 rounded-lg bg-white"
        style={{ height: 'min(560px, 70vh)' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  )
}
