import type { ComponentType } from 'react';

export interface FeatureMetadata { id: string; path: string; label: string; description?: string }
export interface FeatureEntry extends FeatureMetadata { Component: ComponentType }

export function validateFeatureMetadata(value: unknown): value is FeatureMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return Object.keys(object).every((key) => ['id', 'path', 'label', 'description'].includes(key))
    && typeof object.id === 'string' && object.id.length <= 48 && /^[a-z][a-z0-9-]*$/.test(object.id)
    && typeof object.path === 'string' && object.path.length <= 128 && /^\/[a-z][a-z0-9/-]*$/.test(object.path)
    && typeof object.label === 'string' && object.label.length >= 1 && object.label.length <= 40
    && (object.description === undefined || (typeof object.description === 'string'
      && object.description.length >= 1 && object.description.length <= 240));
}

export function defineFeatures(features: FeatureEntry[]): FeatureEntry[] {
  if (!features.length) throw new Error('At least one feature is required');
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const { Component, ...metadata } of features) {
    if (!validateFeatureMetadata(metadata) || !Component || ids.has(metadata.id) || paths.has(metadata.path)) {
      throw new Error('Invalid or duplicate feature registration');
    }
    ids.add(metadata.id); paths.add(metadata.path);
  }
  return features;
}
