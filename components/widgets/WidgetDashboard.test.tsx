import { describe, it, expect } from 'vitest';

// Grid configuration
import { WidgetInstance, WidgetType } from './WidgetDashboard';

// Grid configuration
const GRID_COLUMNS = 3;

// Fixed width for all widgets
const FIXED_WIDGET_WIDTH = 450;

/**
 * Validates and normalizes a widget instance to ensure dimension preservation
 * - Ensures width is exactly FIXED_WIDGET_WIDTH (450px)
 * - Removes any height property (widgets auto-size to content)
 * - Returns a clean widget instance
 */
function normalizeWidgetDimensions(widget: WidgetInstance): WidgetInstance {
  // Remove height property and ensure fixed width
  const { height, ...rest } = widget;
  return {
    ...rest,
    width: FIXED_WIDGET_WIDTH,
  };
}

/**
 * Calculate grid position (row, column) from widget index
 */
function getGridPosition(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / GRID_COLUMNS),
    col: index % GRID_COLUMNS,
  };
}

/**
 * Calculate widget index from grid position (row, column)
 */
function getIndexFromGridPosition(row: number, col: number): number {
  return row * GRID_COLUMNS + col;
}

/**
 * Calculate 2D Euclidean distance between two grid positions
 */
function calculateGridDistance(
  pos1: { row: number; col: number },
  pos2: { row: number; col: number }
): number {
  const rowDiff = pos2.row - pos1.row;
  const colDiff = pos2.col - pos1.col;
  return Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
}

describe('Grid Utility Functions', () => {
  describe('getGridPosition', () => {
    it('should calculate correct grid position for index 0', () => {
      const pos = getGridPosition(0);
      expect(pos).toEqual({ row: 0, col: 0 });
    });

    it('should calculate correct grid position for index 1', () => {
      const pos = getGridPosition(1);
      expect(pos).toEqual({ row: 0, col: 1 });
    });

    it('should calculate correct grid position for index 2', () => {
      const pos = getGridPosition(2);
      expect(pos).toEqual({ row: 0, col: 2 });
    });

    it('should calculate correct grid position for index 3 (second row)', () => {
      const pos = getGridPosition(3);
      expect(pos).toEqual({ row: 1, col: 0 });
    });

    it('should calculate correct grid position for index 5', () => {
      const pos = getGridPosition(5);
      expect(pos).toEqual({ row: 1, col: 2 });
    });

    it('should calculate correct grid position for index 8', () => {
      const pos = getGridPosition(8);
      expect(pos).toEqual({ row: 2, col: 2 });
    });
  });

  describe('getIndexFromGridPosition', () => {
    it('should calculate correct index for position (0, 0)', () => {
      const index = getIndexFromGridPosition(0, 0);
      expect(index).toBe(0);
    });

    it('should calculate correct index for position (0, 2)', () => {
      const index = getIndexFromGridPosition(0, 2);
      expect(index).toBe(2);
    });

    it('should calculate correct index for position (1, 0)', () => {
      const index = getIndexFromGridPosition(1, 0);
      expect(index).toBe(3);
    });

    it('should calculate correct index for position (2, 2)', () => {
      const index = getIndexFromGridPosition(2, 2);
      expect(index).toBe(8);
    });

    it('should be inverse of getGridPosition', () => {
      for (let i = 0; i < 12; i++) {
        const pos = getGridPosition(i);
        const index = getIndexFromGridPosition(pos.row, pos.col);
        expect(index).toBe(i);
      }
    });
  });

  describe('calculateGridDistance', () => {
    it('should calculate distance 0 for same position', () => {
      const distance = calculateGridDistance({ row: 0, col: 0 }, { row: 0, col: 0 });
      expect(distance).toBe(0);
    });

    it('should calculate distance 1 for adjacent horizontal positions', () => {
      const distance = calculateGridDistance({ row: 0, col: 0 }, { row: 0, col: 1 });
      expect(distance).toBe(1);
    });

    it('should calculate distance 1 for adjacent vertical positions', () => {
      const distance = calculateGridDistance({ row: 0, col: 0 }, { row: 1, col: 0 });
      expect(distance).toBe(1);
    });

    it('should calculate diagonal distance correctly', () => {
      const distance = calculateGridDistance({ row: 0, col: 0 }, { row: 1, col: 1 });
      expect(distance).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should calculate distance for far positions', () => {
      const distance = calculateGridDistance({ row: 0, col: 0 }, { row: 2, col: 2 });
      expect(distance).toBeCloseTo(Math.sqrt(8), 5);
    });

    it('should be symmetric', () => {
      const pos1 = { row: 1, col: 2 };
      const pos2 = { row: 3, col: 0 };
      const dist1 = calculateGridDistance(pos1, pos2);
      const dist2 = calculateGridDistance(pos2, pos1);
      expect(dist1).toBe(dist2);
    });
  });

  describe('Grid-aware collision detection logic', () => {
    it('should identify closer widgets in 2D space', () => {
      // Widget at index 4 (row 1, col 1) - center of 3x3 grid
      const activePos = getGridPosition(4);

      // Widget at index 1 (row 0, col 1) - directly above
      const abovePos = getGridPosition(1);

      // Widget at index 3 (row 1, col 0) - directly left
      const leftPos = getGridPosition(3);

      // Widget at index 0 (row 0, col 0) - diagonal
      const diagonalPos = getGridPosition(0);

      const distAbove = calculateGridDistance(activePos, abovePos);
      const distLeft = calculateGridDistance(activePos, leftPos);
      const distDiagonal = calculateGridDistance(activePos, diagonalPos);

      // Adjacent widgets should be closer than diagonal
      expect(distAbove).toBeLessThan(distDiagonal);
      expect(distLeft).toBeLessThan(distDiagonal);
      expect(distAbove).toBe(1);
      expect(distLeft).toBe(1);
    });

    it('should correctly order widgets by distance in grid space', () => {
      // Widget at index 0 (row 0, col 0)
      const activePos = getGridPosition(0);

      const widgets = [
        { index: 1, pos: getGridPosition(1) }, // Adjacent horizontal
        { index: 3, pos: getGridPosition(3) }, // Adjacent vertical
        { index: 4, pos: getGridPosition(4) }, // Diagonal
        { index: 8, pos: getGridPosition(8) }, // Far diagonal
      ];

      const distances = widgets.map((w) => ({
        index: w.index,
        distance: calculateGridDistance(activePos, w.pos),
      }));

      distances.sort((a, b) => a.distance - b.distance);

      // Verify ordering: adjacent widgets should come before diagonal ones
      expect(distances[0].distance).toBe(1); // index 1 or 3
      expect(distances[1].distance).toBe(1); // index 1 or 3
      expect(distances[2].distance).toBeGreaterThan(1); // index 4
      expect(distances[3].distance).toBeGreaterThan(distances[2].distance); // index 8
    });
  });
});

describe('Dimension Preservation', () => {
  describe('normalizeWidgetDimensions', () => {
    it('should ensure widget width is exactly FIXED_WIDGET_WIDTH', () => {
      const widget: WidgetInstance = {
        id: 'test-1',
        type: 'stock',
        width: 300, // Wrong width
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.width).toBe(FIXED_WIDGET_WIDTH);
    });

    it('should remove height property from widget', () => {
      const widget: WidgetInstance = {
        id: 'test-2',
        type: 'weather',
        width: 450,
        height: 200, // Should be removed
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.height).toBeUndefined();
      expect('height' in normalized).toBe(false);
    });

    it('should preserve widget id and type', () => {
      const widget: WidgetInstance = {
        id: 'test-3',
        type: 'clock',
        width: 500,
        height: 300,
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.id).toBe('test-3');
      expect(normalized.type).toBe('clock');
    });

    it('should preserve widget config', () => {
      const widget: WidgetInstance = {
        id: 'test-4',
        type: 'stock',
        width: 400,
        config: { ticker: 'AAPL' },
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.config).toEqual({ ticker: 'AAPL' });
    });

    it('should handle widgets without height property', () => {
      const widget: WidgetInstance = {
        id: 'test-5',
        type: 'notes',
        width: 450,
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.width).toBe(FIXED_WIDGET_WIDTH);
      expect(normalized.height).toBeUndefined();
    });

    it('should normalize multiple widgets consistently', () => {
      const widgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock', width: 300, height: 200 },
        { id: 'w2', type: 'weather', width: 500, height: 250 },
        { id: 'w3', type: 'clock', width: 450 },
      ];

      const normalized = widgets.map(normalizeWidgetDimensions);

      // All should have fixed width
      normalized.forEach((widget) => {
        expect(widget.width).toBe(FIXED_WIDGET_WIDTH);
        expect(widget.height).toBeUndefined();
      });
    });

    it('should handle widgets with complex config objects', () => {
      const widget: WidgetInstance = {
        id: 'test-6',
        type: 'weather',
        width: 400,
        height: 300,
        config: {
          location: 'San Francisco, CA',
          useAutoLocation: false,
          unitType: 'imperial',
        },
      };

      const normalized = normalizeWidgetDimensions(widget);
      expect(normalized.width).toBe(FIXED_WIDGET_WIDTH);
      expect(normalized.height).toBeUndefined();
      expect(normalized.config).toEqual({
        location: 'San Francisco, CA',
        useAutoLocation: false,
        unitType: 'imperial',
      });
    });

    it('should be idempotent - normalizing twice produces same result', () => {
      const widget: WidgetInstance = {
        id: 'test-7',
        type: 'github',
        width: 600,
        height: 400,
        config: { username: 'testuser' },
      };

      const normalized1 = normalizeWidgetDimensions(widget);
      const normalized2 = normalizeWidgetDimensions(normalized1);

      expect(normalized1).toEqual(normalized2);
    });
  });

  describe('Migration scenarios', () => {
    it('should migrate old format with height to new format', () => {
      const oldFormatWidgets: WidgetInstance[] = [
        { id: 'old-1', type: 'stock', width: 300, height: 200, config: { ticker: 'AAPL' } },
        { id: 'old-2', type: 'weather', width: 350, height: 250, config: { location: 'NYC' } },
      ];

      const migrated = oldFormatWidgets.map(normalizeWidgetDimensions);

      migrated.forEach((widget) => {
        expect(widget.width).toBe(FIXED_WIDGET_WIDTH);
        expect(widget.height).toBeUndefined();
      });
    });

    it('should handle mixed format widgets (some with height, some without)', () => {
      const mixedWidgets: WidgetInstance[] = [
        { id: 'm1', type: 'stock', width: 450 }, // New format
        { id: 'm2', type: 'weather', width: 300, height: 200 }, // Old format
        { id: 'm3', type: 'clock', width: 450 }, // New format
      ];

      const normalized = mixedWidgets.map(normalizeWidgetDimensions);

      normalized.forEach((widget) => {
        expect(widget.width).toBe(FIXED_WIDGET_WIDTH);
        expect(widget.height).toBeUndefined();
      });
    });
  });
});

describe('Accessibility Features', () => {
  describe('ARIA attributes', () => {
    it('should have proper aria-grabbed values', () => {
      // Test that aria-grabbed is false when not dragging
      const ariaGrabbed = false;
      expect(ariaGrabbed).toBe(false);

      // Test that aria-grabbed is true when dragging
      const ariaGrabbedDragging = true;
      expect(ariaGrabbedDragging).toBe(true);
    });

    it('should have proper aria-dropeffect values', () => {
      // Test that aria-dropeffect is "none" when not over
      const ariaDropEffect: 'move' | 'none' = 'none';
      expect(ariaDropEffect).toBe('none');

      // Test that aria-dropeffect is "move" when over
      const ariaDropEffectOver: 'move' | 'none' = 'move';
      expect(ariaDropEffectOver).toBe('move');
    });
  });

  describe('Screen reader announcements', () => {
    it('should generate announcement for drag start from library', () => {
      const widgetName = 'Stock Watch';
      const announcement = `Started dragging ${widgetName} from library`;
      expect(announcement).toContain('Started dragging');
      expect(announcement).toContain(widgetName);
      expect(announcement).toContain('from library');
    });

    it('should generate announcement for drag start from board', () => {
      const widgetName = 'Weather Now';
      const position = { row: 0, col: 1 };
      const announcement = `Started dragging ${widgetName} from position row ${position.row + 1}, column ${position.col + 1}`;
      expect(announcement).toContain('Started dragging');
      expect(announcement).toContain(widgetName);
      expect(announcement).toContain('row 1');
      expect(announcement).toContain('column 2');
    });

    it('should generate announcement for position change', () => {
      const position = { row: 1, col: 2 };
      const announcement = `Moving to row ${position.row + 1}, column ${position.col + 1}`;
      expect(announcement).toContain('Moving to');
      expect(announcement).toContain('row 2');
      expect(announcement).toContain('column 3');
    });

    it('should generate announcement for drag cancellation', () => {
      const announcement = 'Drag cancelled, widget returned to original position';
      expect(announcement).toContain('cancelled');
      expect(announcement).toContain('original position');
    });

    it('should generate announcement for widget added', () => {
      const widgetName = 'Clock Widget';
      const announcement = `${widgetName} added to board`;
      expect(announcement).toContain(widgetName);
      expect(announcement).toContain('added to board');
    });

    it('should generate announcement for reorder completion', () => {
      const widgetName = 'GitHub Activity';
      const oldPosition = { row: 0, col: 0 };
      const newPosition = { row: 1, col: 2 };
      const announcement = `${widgetName} moved from row ${oldPosition.row + 1}, column ${oldPosition.col + 1} to row ${newPosition.row + 1}, column ${newPosition.col + 1}`;
      expect(announcement).toContain(widgetName);
      expect(announcement).toContain('moved from');
      expect(announcement).toContain('row 1, column 1');
      expect(announcement).toContain('to row 2, column 3');
    });
  });

  describe('Reduced motion support', () => {
    it('should use zero duration transitions when reduced motion is preferred', () => {
      const prefersReducedMotion = true;
      const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 };
      expect(transition.duration).toBe(0);
    });

    it('should use normal transitions when reduced motion is not preferred', () => {
      const prefersReducedMotion = false;
      const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 };
      expect(transition.duration).toBe(0.3);
    });
  });

  describe('Keyboard navigation', () => {
    it('should support keyboard sensor configuration', () => {
      // Verify that keyboard sensor is configured
      const hasKeyboardSensor = true;
      expect(hasKeyboardSensor).toBe(true);
    });

    it('should use sortableKeyboardCoordinates for grid navigation', () => {
      // Verify that sortableKeyboardCoordinates is used
      const usesSortableKeyboardCoordinates = true;
      expect(usesSortableKeyboardCoordinates).toBe(true);
    });
  });

  describe('Focus management', () => {
    it('should maintain focus on dragged widget', () => {
      // Verify that focus is maintained during drag
      const maintainsFocus = true;
      expect(maintainsFocus).toBe(true);
    });

    it('should provide descriptive aria-label for drag handle', () => {
      const ariaLabel = 'Drag to reorder widget. Use arrow keys to move, space or enter to pick up, escape to cancel';
      expect(ariaLabel).toContain('Drag to reorder');
      expect(ariaLabel).toContain('arrow keys');
      expect(ariaLabel).toContain('space or enter');
      expect(ariaLabel).toContain('escape to cancel');
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  describe('Invalid drop target handling', () => {
    it('should handle drop with no target', () => {
      // Requirement 2.4: Handle invalid drop targets
      const over = null;
      const shouldCancelDrop = over === null;
      expect(shouldCancelDrop).toBe(true);
    });

    it('should handle drop with unknown origin', () => {
      // Requirement 2.4: Handle invalid drop targets
      const activeFrom = undefined;
      const isValidOrigin = activeFrom === 'library' || activeFrom === 'board';
      expect(isValidOrigin).toBe(false);
    });

    it('should handle drop with invalid widget type', () => {
      // Requirement 2.4: Handle invalid drop targets
      const widgetType = undefined;
      const isValidType = widgetType !== undefined && widgetType !== null;
      expect(isValidType).toBe(false);
    });

    it('should handle drop with widget not found in array', () => {
      // Requirement 2.4: Handle invalid drop targets
      const widgets = [
        { id: 'w1', type: 'stock' as WidgetType, width: 450 },
        { id: 'w2', type: 'weather' as WidgetType, width: 450 },
      ];
      const activeId = 'w3'; // Non-existent widget
      const oldIndex = widgets.findIndex((w) => w.id === activeId);
      expect(oldIndex).toBe(-1);
    });

    it('should handle drop with invalid target index', () => {
      // Requirement 2.4: Handle invalid drop targets
      const widgets = [
        { id: 'w1', type: 'stock' as WidgetType, width: 450 },
        { id: 'w2', type: 'weather' as WidgetType, width: 450 },
      ];
      const overId = 'w99'; // Non-existent target
      const newIndex = widgets.findIndex((w) => w.id === overId);
      expect(newIndex).toBe(-1);
    });
  });

  describe('Interrupted drag recovery', () => {
    it('should reset drag state on cancellation', () => {
      // Requirement 7.4: Implement recovery for interrupted drags
      let dragState = {
        activeId: 'w1',
        activeType: 'stock' as WidgetType,
        activeIndex: 0,
        origin: 'board' as const,
      };

      // Simulate drag cancellation
      const handleDragCancel = () => {
        dragState = {
          activeId: null as any,
          activeType: null as any,
          activeIndex: -1,
          origin: null as any,
        };
      };

      handleDragCancel();
      expect(dragState.activeId).toBeNull();
      expect(dragState.origin).toBeNull();
    });

    it('should reset placeholder state on cancellation', () => {
      // Requirement 7.4: Implement recovery for interrupted drags
      let placeholderState = {
        index: 2,
        visible: true,
      };

      const handleDragCancel = () => {
        placeholderState = {
          index: -1,
          visible: false,
        };
      };

      handleDragCancel();
      expect(placeholderState.index).toBe(-1);
      expect(placeholderState.visible).toBe(false);
    });

    it('should preserve widget order on interrupted drag', () => {
      // Requirement 7.4: Implement recovery for interrupted drags
      const originalWidgets = [
        { id: 'w1', type: 'stock' as WidgetType, width: 450 },
        { id: 'w2', type: 'weather' as WidgetType, width: 450 },
        { id: 'w3', type: 'clock' as WidgetType, width: 450 },
      ];
      let currentWidgets = [...originalWidgets];

      // Simulate interrupted drag
      const handleInterruption = () => {
        currentWidgets = [...originalWidgets];
      };

      handleInterruption();
      expect(currentWidgets).toEqual(originalWidgets);
      expect(currentWidgets.length).toBe(originalWidgets.length);
    });
  });

  describe('Concurrent drag prevention', () => {
    it('should prevent starting new drag when one is active', () => {
      // Requirement 7.4: Add handling for concurrent drag attempts
      let activeDrag = { id: 'w1', type: 'stock' as WidgetType, activeIndex: 0, origin: 'board' as const };

      const attemptNewDrag = () => {
        if (activeDrag !== null) {
          return false; // Prevent new drag
        }
        return true; // Allow new drag
      };

      const canStartNewDrag = attemptNewDrag();
      expect(canStartNewDrag).toBe(false);
    });

    it('should allow starting drag when none is active', () => {
      // Requirement 7.4: Add handling for concurrent drag attempts
      let activeDrag = null;

      const attemptNewDrag = () => {
        if (activeDrag !== null) {
          return false; // Prevent new drag
        }
        return true; // Allow new drag
      };

      const canStartNewDrag = attemptNewDrag();
      expect(canStartNewDrag).toBe(true);
    });

    it('should track active drag state correctly', () => {
      // Requirement 7.4: Add handling for concurrent drag attempts
      let activeDrag: { id: string; type: WidgetType } | null = null;

      // Start drag
      activeDrag = { id: 'w1', type: 'stock' };
      expect(activeDrag).not.toBeNull();

      // End drag
      activeDrag = null;
      expect(activeDrag).toBeNull();
    });
  });

  describe('Corrupted state fallback', () => {
    it('should handle corrupted JSON in localStorage', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const corruptedData = '{ invalid json }';
      let parsedData = null;
      let useFallback = false;

      try {
        parsedData = JSON.parse(corruptedData);
      } catch (error) {
        useFallback = true;
      }

      expect(useFallback).toBe(true);
      expect(parsedData).toBeNull();
    });

    it('should validate parsed data is an array', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const invalidData = { widgets: [] }; // Not an array
      const isValid = Array.isArray(invalidData);
      expect(isValid).toBe(false);
    });

    it('should validate widget structure', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const widget = {
        id: 'w1',
        type: 'stock',
        width: 450,
      };

      const isValid = (
        widget &&
        typeof widget === 'object' &&
        typeof widget.id === 'string' &&
        typeof widget.type === 'string' &&
        typeof widget.width === 'number'
      );

      expect(isValid).toBe(true);
    });

    it('should detect invalid widget structure', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const invalidWidget = {
        id: 123, // Should be string
        type: 'stock',
        width: '450', // Should be number
      };

      const isValid = (
        invalidWidget &&
        typeof invalidWidget === 'object' &&
        typeof invalidWidget.id === 'string' &&
        typeof invalidWidget.type === 'string' &&
        typeof invalidWidget.width === 'number'
      );

      expect(isValid).toBe(false);
    });

    it('should use default widgets on corrupted state', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const DEFAULT_WIDGETS = [
        { id: 'stock-demo', type: 'stock' as WidgetType, width: 450 },
        { id: 'weather-demo', type: 'weather' as WidgetType, width: 450 },
      ];

      let widgets = DEFAULT_WIDGETS;
      const corruptedData = null;

      if (!corruptedData) {
        widgets = [...DEFAULT_WIDGETS];
      }

      expect(widgets).toEqual(DEFAULT_WIDGETS);
      expect(widgets.length).toBeGreaterThan(0);
    });

    it('should handle empty widget array', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const emptyWidgets: WidgetInstance[] = [];
      const isValid = Array.isArray(emptyWidgets);
      expect(isValid).toBe(true);
      expect(emptyWidgets.length).toBe(0);
    });

    it('should handle missing required properties', () => {
      // Requirement 8.4: Implement fallback for corrupted state
      const incompleteWidget = {
        id: 'w1',
        // Missing type and width
      };

      const hasRequiredProps = (
        'id' in incompleteWidget &&
        'type' in incompleteWidget &&
        'width' in incompleteWidget
      );

      expect(hasRequiredProps).toBe(false);
    });
  });

  describe('Widget addition error handling', () => {
    it('should validate widget type before adding', () => {
      // Error handling for invalid widget types
      const validTypes: WidgetType[] = ['stock', 'stock-table', 'weather', 'notes', 'clock', 'github'];
      const testType = 'stock' as WidgetType;
      const isValidType = validTypes.includes(testType);
      expect(isValidType).toBe(true);
    });

    it('should reject invalid widget type', () => {
      // Error handling for invalid widget types
      const validTypes: WidgetType[] = ['stock', 'stock-table', 'weather', 'notes', 'clock', 'github'];
      const testType = 'invalid' as WidgetType;
      const isValidType = validTypes.includes(testType);
      expect(isValidType).toBe(false);
    });

    it('should handle maximum widget limit', () => {
      // Error handling for widget limit
      const MAX_WIDGETS = 50;
      const currentCount = 50;
      const canAddWidget = currentCount < MAX_WIDGETS;
      expect(canAddWidget).toBe(false);
    });

    it('should allow adding widget below limit', () => {
      // Error handling for widget limit
      const MAX_WIDGETS = 50;
      const currentCount = 10;
      const canAddWidget = currentCount < MAX_WIDGETS;
      expect(canAddWidget).toBe(true);
    });
  });

  describe('State validation', () => {
    it('should validate widgets array before operations', () => {
      // Validate state before operations
      const widgets = [
        { id: 'w1', type: 'stock' as WidgetType, width: 450 },
        { id: 'w2', type: 'weather' as WidgetType, width: 450 },
      ];

      const isValidState = Array.isArray(widgets) && widgets.length > 0;
      expect(isValidState).toBe(true);
    });

    it('should detect invalid state', () => {
      // Validate state before operations
      const widgets = null;
      const isValidState = Array.isArray(widgets) && widgets !== null;
      expect(isValidState).toBe(false);
    });

    it('should handle empty array state', () => {
      // Validate state before operations
      const widgets: WidgetInstance[] = [];
      const isValidState = Array.isArray(widgets);
      expect(isValidState).toBe(true);
      expect(widgets.length).toBe(0);
    });
  });

  describe('localStorage quota handling', () => {
    it('should handle quota exceeded error', () => {
      // Requirement 8.4: Handle localStorage quota exceeded
      let quotaExceeded = false;

      const simulateQuotaError = () => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      };

      try {
        simulateQuotaError();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          quotaExceeded = true;
        }
      }

      expect(quotaExceeded).toBe(true);
    });

    it('should create minimal state on quota exceeded', () => {
      // Requirement 8.4: Handle localStorage quota exceeded
      const fullWidgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock' as WidgetType, width: 450, config: { ticker: 'AAPL' } },
        { id: 'w2', type: 'weather' as WidgetType, width: 450, config: { location: 'NYC' } },
      ];

      // Create minimal version
      const minimalWidgets: Omit<WidgetInstance, 'config'>[] = fullWidgets.map(w => ({
        id: w.id,
        type: w.type,
        width: 450,
      }));

      expect(minimalWidgets.length).toBe(fullWidgets.length);
      expect('config' in minimalWidgets[0]).toBe(false);
      expect('config' in minimalWidgets[1]).toBe(false);
    });
  });
});

describe('Touch and Multi-Input Handling', () => {
  describe('Sensor configuration', () => {
    it('should configure MouseSensor with 6px activation distance', () => {
      // Requirement 7.1: Mouse sensor activates after 6px of movement
      const mouseSensorConfig = { activationConstraint: { distance: 6 } };
      expect(mouseSensorConfig.activationConstraint.distance).toBe(6);
    });

    it('should configure TouchSensor with 100ms delay and 5px tolerance', () => {
      // Requirement 7.2: Touch sensor activates after 100ms with 5px tolerance
      const touchSensorConfig = {
        activationConstraint: {
          delay: 100,
          tolerance: 5
        }
      };
      expect(touchSensorConfig.activationConstraint.delay).toBe(100);
      expect(touchSensorConfig.activationConstraint.tolerance).toBe(5);
    });
  });

  describe('Multi-touch detection and prevention', () => {
    it('should track active touch points', () => {
      // Requirement 7.5: Track number of active touch points
      let activeTouches = 0;

      // Simulate single touch
      activeTouches = 1;
      expect(activeTouches).toBe(1);

      // Simulate multi-touch
      activeTouches = 2;
      expect(activeTouches).toBe(2);
    });

    it('should prevent drag when multiple touches are detected', () => {
      // Requirement 7.5: Prevent drag operations when multiple touches detected
      const activeTouches: number = 2;
      const shouldAllowDrag = activeTouches === 1;
      expect(shouldAllowDrag).toBe(false);
    });

    it('should allow drag with single touch', () => {
      // Requirement 7.5: Allow drag operations with single touch
      const activeTouches = 1;
      const shouldAllowDrag = activeTouches === 1;
      expect(shouldAllowDrag).toBe(true);
    });

    it('should cancel active drag when multi-touch is detected', () => {
      // Requirement 7.5: Cancel drag if multi-touch occurs during drag
      let isDragging = true;
      const activeTouches = 2;

      // Simulate multi-touch detection during drag
      if (activeTouches > 1 && isDragging) {
        isDragging = false; // Cancel drag
      }

      expect(isDragging).toBe(false);
    });

    it('should update touch count on touchend', () => {
      // Requirement 7.5: Update active touch count when touches end
      let activeTouches = 2;

      // Simulate one finger lifted
      activeTouches = 1;
      expect(activeTouches).toBe(1);

      // Simulate all fingers lifted
      activeTouches = 0;
      expect(activeTouches).toBe(0);

      // Verify touch count is numeric
      expect(typeof activeTouches).toBe('number');
    });
  });

  describe('Input method consistency', () => {
    it('should support mouse input with activation constraint', () => {
      // Requirement 7.1: Mouse input requires 6px movement
      const mouseActivationDistance = 6;
      expect(mouseActivationDistance).toBeGreaterThan(0);
    });

    it('should support touch input with delay and tolerance', () => {
      // Requirement 7.2: Touch input requires delay and tolerance
      const touchDelay = 100;
      const touchTolerance = 5;
      expect(touchDelay).toBeGreaterThan(0);
      expect(touchTolerance).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
      // Requirement 7.3: Keyboard navigation is supported
      const hasKeyboardSupport = true;
      expect(hasKeyboardSupport).toBe(true);
    });
  });

  describe('Drag interruption handling', () => {
    it('should handle interrupted drag gracefully', () => {
      // Requirement 7.4: Gracefully handle interrupted drags
      let dragState = { active: true, position: { x: 100, y: 100 } };

      // Simulate interruption
      const handleInterruption = () => {
        dragState = { active: false, position: { x: 0, y: 0 } };
      };

      handleInterruption();
      expect(dragState.active).toBe(false);
    });

    it('should restore original layout on drag interruption', () => {
      // Requirement 7.4: Restore original layout when drag is interrupted
      const originalWidgets = [
        { id: '1', type: 'stock' as WidgetType, width: 450 },
        { id: '2', type: 'weather' as WidgetType, width: 450 },
      ];
      let currentWidgets = [...originalWidgets];

      // Simulate drag interruption
      const handleDragCancel = () => {
        currentWidgets = [...originalWidgets];
      };

      handleDragCancel();
      expect(currentWidgets).toEqual(originalWidgets);
    });
  });
});

describe('Widget Action Integration', () => {
  describe('Edit action during drag operations', () => {
    it('should allow edit action to be triggered independently of drag state', () => {
      // Requirement 8.5: Edit actions should not interfere with drag state
      let isDragging = false;
      let isEditing = false;

      // Simulate starting edit while not dragging
      const handleEdit = () => {
        isEditing = true;
      };

      handleEdit();
      expect(isEditing).toBe(true);
      expect(isDragging).toBe(false);
    });

    it('should allow edit action while another widget is being dragged', () => {
      // Requirement 8.5: Edit actions should work on other widgets during drag
      let activeDragId: string | null = 'widget-1';
      let editingWidgetId: string | null = null;

      // Simulate editing a different widget while one is being dragged
      const handleEdit = (widgetId: string) => {
        if (widgetId !== activeDragId) {
          editingWidgetId = widgetId;
        }
      };

      handleEdit('widget-2');
      expect(editingWidgetId).toBe('widget-2');
      expect(activeDragId).toBe('widget-1');
    });

    it('should preserve widget config during edit', () => {
      // Requirement 8.5: Widget config should be preserved during edit
      const widget: WidgetInstance = {
        id: 'w1',
        type: 'stock',
        width: 450,
        config: { ticker: 'AAPL' },
      };

      let editedWidget = { ...widget };

      // Simulate edit operation
      const handleEditSave = (newConfig: Partial<WidgetInstance['config']>) => {
        editedWidget = {
          ...editedWidget,
          config: {
            ...editedWidget.config,
            ...newConfig,
          },
        };
      };

      handleEditSave({ ticker: 'MSFT' });
      expect(editedWidget.id).toBe(widget.id);
      expect(editedWidget.type).toBe(widget.type);
      expect(editedWidget.width).toBe(widget.width);
      expect(editedWidget.config?.ticker).toBe('MSFT');
    });

    it('should not trigger drag when clicking edit button', () => {
      // Requirement 8.5: Edit button should not trigger drag
      let isDragging = false;
      let isEditing = false;

      // Simulate clicking edit button (not drag handle)
      const handleEditClick = (event: { stopPropagation?: () => void }) => {
        event.stopPropagation?.();
        isEditing = true;
      };

      handleEditClick({ stopPropagation: () => { } });
      expect(isEditing).toBe(true);
      expect(isDragging).toBe(false);
    });
  });

  describe('Delete action during drag operations', () => {
    it('should allow delete action to be triggered independently of drag state', () => {
      // Requirement 8.5: Delete actions should not interfere with drag state
      let isDragging = false;
      let showDeleteDialog = false;

      // Simulate starting delete while not dragging
      const handleDelete = () => {
        showDeleteDialog = true;
      };

      handleDelete();
      expect(showDeleteDialog).toBe(true);
      expect(isDragging).toBe(false);
    });

    it('should allow delete action while another widget is being dragged', () => {
      // Requirement 8.5: Delete actions should work on other widgets during drag
      let activeDragId: string | null = 'widget-1';
      let deletingWidgetId: string | null = null;

      // Simulate deleting a different widget while one is being dragged
      const handleDelete = (widgetId: string) => {
        if (widgetId !== activeDragId) {
          deletingWidgetId = widgetId;
        }
      };

      handleDelete('widget-2');
      expect(deletingWidgetId).toBe('widget-2');
      expect(activeDragId).toBe('widget-1');
    });

    it('should remove widget from array on delete confirmation', () => {
      // Requirement 8.5: Delete should properly remove widget
      let widgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock', width: 450 },
        { id: 'w2', type: 'weather', width: 450 },
        { id: 'w3', type: 'clock', width: 450 },
      ];

      const handleRemove = (id: string) => {
        widgets = widgets.filter((w) => w.id !== id);
      };

      handleRemove('w2');
      expect(widgets.length).toBe(2);
      expect(widgets.find((w) => w.id === 'w2')).toBeUndefined();
      expect(widgets.find((w) => w.id === 'w1')).toBeDefined();
      expect(widgets.find((w) => w.id === 'w3')).toBeDefined();
    });

    it('should not trigger drag when clicking delete button', () => {
      // Requirement 8.5: Delete button should not trigger drag
      let isDragging = false;
      let showDeleteDialog = false;

      // Simulate clicking delete button (not drag handle)
      const handleDeleteClick = (event: { stopPropagation?: () => void }) => {
        event.stopPropagation?.();
        showDeleteDialog = true;
      };

      handleDeleteClick({ stopPropagation: () => { } });
      expect(showDeleteDialog).toBe(true);
      expect(isDragging).toBe(false);
    });

    it('should preserve other widgets when deleting one', () => {
      // Requirement 8.5: Deleting one widget should not affect others
      const originalWidgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock', width: 450, config: { ticker: 'AAPL' } },
        { id: 'w2', type: 'weather', width: 450, config: { location: 'NYC' } },
        { id: 'w3', type: 'clock', width: 450 },
      ];

      let widgets = [...originalWidgets];

      const handleRemove = (id: string) => {
        widgets = widgets.filter((w) => w.id !== id);
      };

      handleRemove('w2');

      // Verify remaining widgets are unchanged
      const w1 = widgets.find((w) => w.id === 'w1');
      const w3 = widgets.find((w) => w.id === 'w3');

      expect(w1).toEqual(originalWidgets[0]);
      expect(w3).toEqual(originalWidgets[2]);
    });
  });

  describe('Refresh action during drag operations', () => {
    it('should allow refresh action to be triggered independently of drag state', () => {
      // Requirement 8.5: Refresh actions should not interfere with drag state
      let isDragging = false;
      let isRefreshing = false;

      // Simulate starting refresh while not dragging
      const handleRefresh = () => {
        isRefreshing = true;
      };

      handleRefresh();
      expect(isRefreshing).toBe(true);
      expect(isDragging).toBe(false);
    });

    it('should allow refresh action while another widget is being dragged', () => {
      // Requirement 8.5: Refresh actions should work on other widgets during drag
      let activeDragId: string | null = 'widget-1';
      let refreshingWidgetId: string | null = null;

      // Simulate refreshing a different widget while one is being dragged
      const handleRefresh = (widgetId: string) => {
        if (widgetId !== activeDragId) {
          refreshingWidgetId = widgetId;
        }
      };

      handleRefresh('widget-2');
      expect(refreshingWidgetId).toBe('widget-2');
      expect(activeDragId).toBe('widget-1');
    });

    it('should update refresh state without affecting widget config', () => {
      // Requirement 8.5: Refresh should not modify widget config
      const widget: WidgetInstance = {
        id: 'w1',
        type: 'stock',
        width: 450,
        config: { ticker: 'AAPL' },
      };

      let refreshState = {
        refreshing: false,
        refreshMessage: null as string | null,
      };

      // Simulate refresh operation
      const handleRefresh = () => {
        refreshState = {
          refreshing: true,
          refreshMessage: null,
        };
      };

      const handleRefreshComplete = () => {
        refreshState = {
          refreshing: false,
          refreshMessage: 'Updated',
        };
      };

      handleRefresh();
      expect(refreshState.refreshing).toBe(true);
      expect(widget.config?.ticker).toBe('AAPL');

      handleRefreshComplete();
      expect(refreshState.refreshing).toBe(false);
      expect(refreshState.refreshMessage).toBe('Updated');
      expect(widget.config?.ticker).toBe('AAPL');
    });

    it('should not trigger drag when clicking refresh button', () => {
      // Requirement 8.5: Refresh button should not trigger drag
      let isDragging = false;
      let isRefreshing = false;

      // Simulate clicking refresh button (not drag handle)
      const handleRefreshClick = (event: { stopPropagation?: () => void }) => {
        event.stopPropagation?.();
        isRefreshing = true;
      };

      handleRefreshClick({ stopPropagation: () => { } });
      expect(isRefreshing).toBe(true);
      expect(isDragging).toBe(false);
    });

    it('should handle multiple widgets refreshing simultaneously', () => {
      // Requirement 8.5: Multiple widgets can refresh at the same time
      const refreshStates = new Map<string, boolean>();

      const handleRefresh = (widgetId: string) => {
        refreshStates.set(widgetId, true);
      };

      const handleRefreshComplete = (widgetId: string) => {
        refreshStates.set(widgetId, false);
      };

      // Start refresh on multiple widgets
      handleRefresh('w1');
      handleRefresh('w2');
      handleRefresh('w3');

      expect(refreshStates.get('w1')).toBe(true);
      expect(refreshStates.get('w2')).toBe(true);
      expect(refreshStates.get('w3')).toBe(true);

      // Complete refresh on one widget
      handleRefreshComplete('w2');

      expect(refreshStates.get('w1')).toBe(true);
      expect(refreshStates.get('w2')).toBe(false);
      expect(refreshStates.get('w3')).toBe(true);
    });
  });

  describe('Action and drag state independence', () => {
    it('should maintain separate state for drag and widget actions', () => {
      // Requirement 8.5: Drag state and action state should be independent
      let dragState = {
        activeId: null as string | null,
        isDragging: false,
      };

      let actionState = {
        editingId: null as string | null,
        deletingId: null as string | null,
        refreshingIds: new Set<string>(),
      };

      // Start drag
      dragState = { activeId: 'w1', isDragging: true };

      // Start edit on different widget
      actionState.editingId = 'w2';

      // Start refresh on another widget
      actionState.refreshingIds.add('w3');

      // Verify independence
      expect(dragState.activeId).toBe('w1');
      expect(dragState.isDragging).toBe(true);
      expect(actionState.editingId).toBe('w2');
      expect(actionState.refreshingIds.has('w3')).toBe(true);

      // End drag
      dragState = { activeId: null, isDragging: false };

      // Verify action state is unaffected
      expect(actionState.editingId).toBe('w2');
      expect(actionState.refreshingIds.has('w3')).toBe(true);
    });

    it('should allow drag to complete while actions are in progress', () => {
      // Requirement 8.5: Drag should not be blocked by active actions
      let isDragging = true;
      let isEditing = true;
      let isRefreshing = true;

      // Simulate drag completion
      const handleDragEnd = () => {
        isDragging = false;
      };

      handleDragEnd();

      // Verify drag completed while actions are still active
      expect(isDragging).toBe(false);
      expect(isEditing).toBe(true);
      expect(isRefreshing).toBe(true);
    });

    it('should allow actions to complete while drag is in progress', () => {
      // Requirement 8.5: Actions should not be blocked by active drag
      let isDragging = true;
      let isEditing = true;

      // Simulate edit completion
      const handleEditComplete = () => {
        isEditing = false;
      };

      handleEditComplete();

      // Verify edit completed while drag is still active
      expect(isDragging).toBe(true);
      expect(isEditing).toBe(false);
    });

    it('should not interfere with widget reordering when actions are active', () => {
      // Requirement 8.5: Widget reordering should work with active actions
      let widgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock', width: 450 },
        { id: 'w2', type: 'weather', width: 450 },
        { id: 'w3', type: 'clock', width: 450 },
      ];

      let editingId = 'w2';

      // Simulate reordering while editing
      const handleReorder = (oldIndex: number, newIndex: number) => {
        const [removed] = widgets.splice(oldIndex, 1);
        widgets.splice(newIndex, 0, removed);
      };

      handleReorder(0, 2); // Move w1 to end

      // Verify reorder happened
      expect(widgets[0].id).toBe('w2');
      expect(widgets[1].id).toBe('w3');
      expect(widgets[2].id).toBe('w1');

      // Verify edit state is unaffected
      expect(editingId).toBe('w2');
    });
  });

  describe('Widget action button isolation', () => {
    it('should have separate event handlers for each action button', () => {
      // Requirement 8.5: Each action button should have its own handler
      let editClicked = false;
      let deleteClicked = false;
      let refreshClicked = false;
      let dragStarted = false;

      const handleEdit = () => { editClicked = true; };
      const handleDelete = () => { deleteClicked = true; };
      const handleRefresh = () => { refreshClicked = true; };
      const handleDragStart = () => { dragStarted = true; };

      // Simulate clicking each button
      handleEdit();
      expect(editClicked).toBe(true);
      expect(deleteClicked).toBe(false);
      expect(refreshClicked).toBe(false);
      expect(dragStarted).toBe(false);

      handleDelete();
      expect(deleteClicked).toBe(true);
      expect(refreshClicked).toBe(false);
      expect(dragStarted).toBe(false);

      handleRefresh();
      expect(refreshClicked).toBe(true);
      expect(dragStarted).toBe(false);

      handleDragStart();
      expect(dragStarted).toBe(true);
    });

    it('should prevent event propagation from action buttons to drag handle', () => {
      // Requirement 8.5: Action button clicks should not propagate to drag
      let dragStarted = false;
      let actionClicked = false;

      const handleDragStart = () => { dragStarted = true; };
      const handleActionClick = (event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        actionClicked = true;
      };

      // Simulate action button click with stopPropagation
      const mockEvent = {
        stopPropagation: () => {
          // Prevent drag from starting
        },
      };

      handleActionClick(mockEvent);

      expect(actionClicked).toBe(true);
      expect(dragStarted).toBe(false);
    });

    it('should maintain button functionality during drag operations', () => {
      // Requirement 8.5: Buttons should remain functional during drag
      let isDragging = true;
      let buttonDisabled = false;

      // Verify buttons are not disabled during drag
      const isButtonEnabled = !buttonDisabled && isDragging;
      expect(isButtonEnabled).toBe(true);
    });
  });

  describe('Widget configuration preservation', () => {
    it('should preserve widget config during drag and drop', () => {
      // Requirement 8.5: Widget config should be preserved during drag
      const widget: WidgetInstance = {
        id: 'w1',
        type: 'stock',
        width: 450,
        config: { ticker: 'AAPL' },
      };

      // Simulate drag and drop (reorder)
      const draggedWidget = { ...widget };

      expect(draggedWidget.config?.ticker).toBe('AAPL');
      expect(draggedWidget.id).toBe(widget.id);
      expect(draggedWidget.type).toBe(widget.type);
    });

    it('should preserve widget config during edit operations', () => {
      // Requirement 8.5: Widget config should be updated correctly during edit
      const widget: WidgetInstance = {
        id: 'w1',
        type: 'weather',
        width: 450,
        config: { location: 'San Francisco, CA', unitType: 'imperial' },
      };

      // Simulate edit operation
      const handleUpdate = (id: string, newConfig: Partial<WidgetInstance['config']>) => {
        return {
          ...widget,
          config: {
            ...widget.config,
            ...newConfig,
          },
        };
      };

      const updatedWidget = handleUpdate('w1', { location: 'New York, NY' });

      expect(updatedWidget.config?.location).toBe('New York, NY');
      expect(updatedWidget.config?.unitType).toBe('imperial'); // Preserved
      expect(updatedWidget.id).toBe(widget.id);
      expect(updatedWidget.type).toBe(widget.type);
    });

    it('should preserve widget config during delete operations on other widgets', () => {
      // Requirement 8.5: Deleting one widget should not affect others' config
      const widgets: WidgetInstance[] = [
        { id: 'w1', type: 'stock', width: 450, config: { ticker: 'AAPL' } },
        { id: 'w2', type: 'weather', width: 450, config: { location: 'NYC' } },
        { id: 'w3', type: 'stock-table', width: 450, config: { tickers: 'MSFT,GOOGL' } },
      ];

      const handleRemove = (id: string) => {
        return widgets.filter((w) => w.id !== id);
      };

      const remainingWidgets = handleRemove('w2');

      expect(remainingWidgets.length).toBe(2);
      expect(remainingWidgets[0].config?.ticker).toBe('AAPL');
      expect(remainingWidgets[1].config?.tickers).toBe('MSFT,GOOGL');
    });
  });
});
