import type { FlowNode, FlowEdge } from "@/types";

export const SAMPLE_WORKFLOW_NODES: FlowNode[] = [
  // ---- Branch A: Image Processing ----
  {
    id: "node-upload-image",
    type: "uploadImageNode",
    position: { x: 80, y: 120 },
    data: {
      label: "Upload Image",
    },
  },
  {
    id: "node-crop-image",
    type: "cropImageNode",
    position: { x: 360, y: 120 },
    data: {
      label: "Crop Image",
      xPercent: 10,
      yPercent: 10,
      widthPercent: 80,
      heightPercent: 80,
    },
  },
  {
    id: "node-system-prompt",
    type: "textNode",
    position: { x: 80, y: 380 },
    data: {
      label: "System Prompt",
      content:
        "You are a professional marketing copywriter. Generate a compelling one-paragraph product description.",
    },
  },
  {
    id: "node-product-details",
    type: "textNode",
    position: { x: 360, y: 380 },
    data: {
      label: "Product Details",
      content:
        "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
    },
  },
  {
    id: "node-llm-1",
    type: "llmNode",
    position: { x: 640, y: 220 },
    data: {
      label: "Product Description LLM",
      model: "gemini-2.0-flash",
      isExpanded: false,
    },
  },

  // ---- Branch B: Video Processing ----
  {
    id: "node-upload-video",
    type: "uploadVideoNode",
    position: { x: 80, y: 620 },
    data: {
      label: "Upload Video",
    },
  },
  {
    id: "node-extract-frame",
    type: "extractFrameNode",
    position: { x: 360, y: 620 },
    data: {
      label: "Extract Frame",
      timestamp: "50%",
    },
  },

  // ---- Convergence ----
  {
    id: "node-social-prompt",
    type: "textNode",
    position: { x: 640, y: 540 },
    data: {
      label: "Social Media Prompt",
      content:
        "You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.",
    },
  },
  {
    id: "node-llm-2",
    type: "llmNode",
    position: { x: 940, y: 380 },
    data: {
      label: "Marketing Post LLM",
      model: "gemini-2.0-flash",
      isExpanded: false,
    },
  },
];

export const SAMPLE_WORKFLOW_EDGES: FlowEdge[] = [
  // Branch A connections
  {
    id: "e-upload-crop",
    source: "node-upload-image",
    target: "node-crop-image",
    targetHandle: "image_url",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-system-llm1",
    source: "node-system-prompt",
    target: "node-llm-1",
    targetHandle: "system_prompt",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-details-llm1",
    source: "node-product-details",
    target: "node-llm-1",
    targetHandle: "user_message",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-crop-llm1",
    source: "node-crop-image",
    target: "node-llm-1",
    targetHandle: "images",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },

  // Branch B connections
  {
    id: "e-video-extract",
    source: "node-upload-video",
    target: "node-extract-frame",
    targetHandle: "video_url",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },

  // Convergence connections
  {
    id: "e-social-llm2",
    source: "node-social-prompt",
    target: "node-llm-2",
    targetHandle: "system_prompt",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-llm1-llm2",
    source: "node-llm-1",
    target: "node-llm-2",
    targetHandle: "user_message",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-crop-llm2",
    source: "node-crop-image",
    target: "node-llm-2",
    targetHandle: "images",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
  {
    id: "e-extract-llm2",
    source: "node-extract-frame",
    target: "node-llm-2",
    targetHandle: "images",
    type: "smoothstep",
    animated: true,
    style: { stroke: "rgba(124, 92, 250, 0.8)", strokeWidth: 2 },
  },
];
