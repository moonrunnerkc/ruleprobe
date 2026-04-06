# Task: SearchFilter React Component

Build a reusable SearchFilter component in TypeScript with React.

## Component: SearchFilter

A search and filter UI component that combines a text input with tag-based filtering and displays a result count.

### Props

- `items`: Array of objects to filter. Each object has at least `name` (string) and `tags` (string array).
- `onFilterChange`: Callback invoked with the filtered items array whenever the filter state changes.
- `placeholder`: Optional placeholder text for the search input (default: `"Search..."`)
- `debounceMs`: Optional debounce delay in milliseconds for the text input (default: `300`)
- `availableTags`: Array of strings representing all selectable tags.

### Behavior

1. **Text search**: Filter items where `name` contains the search text (case-insensitive). Debounce the input so filtering only runs after the user stops typing for `debounceMs` milliseconds.

2. **Tag selection**: Render each available tag as a toggleable button. Clicking a tag toggles it on/off. When one or more tags are selected, only show items that include at least one selected tag.

3. **Combined filtering**: When both text and tags are active, apply both filters (intersection). An item must match the text search AND have at least one selected tag.

4. **Result count**: Display a count of matching items, e.g. "12 results" or "No results".

5. **Clear all**: Provide a button to reset both the search text and tag selection.

### Type Definitions

Define and export:
- `FilterableItem`: The shape of items passed to the component
- `SearchFilterProps`: The component's prop types

## Expected Output Structure

```
src/
  components/search-filter.tsx         # Component implementation
  components/search-filter.types.ts    # Type definitions
tests/
  components/search-filter.test.tsx    # Component tests
```

## Deliverables

1. Fully typed SearchFilter component using function component syntax
2. Debounced text input using a custom `useDebounce` hook or inline logic
3. Tag toggle buttons with visual selected/unselected state
4. Tests covering: initial render, text filtering, tag filtering, combined filtering, debounce behavior, and clear functionality
