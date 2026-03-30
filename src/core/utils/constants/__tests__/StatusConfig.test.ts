/**
 * Unit Tests for StatusConfig
 *
 * Tests the member status state machine that enforces valid transitions
 */

import {
  canTransition,
  getValidTransitionsFrom,
  getValidTransitionsTo,
  VALID_TRANSITIONS,
  StatusTransition,
  MemberStatus,
} from '../StatusConfig';

describe('StatusConfig', () => {
  describe('VALID_TRANSITIONS Configuration', () => {
    it('should define exactly 7 valid transitions', () => {
      expect(VALID_TRANSITIONS).toHaveLength(7);
    });

    it('should have all required properties for each transition', () => {
      VALID_TRANSITIONS.forEach((transition: StatusTransition) => {
        expect(transition).toHaveProperty('from');
        expect(transition).toHaveProperty('to');
        expect(transition).toHaveProperty('allowedBy');
        expect(Array.isArray(transition.allowedBy)).toBe(true);
        expect(transition.allowedBy.length).toBeGreaterThan(0);
      });
    });

    it('should only use valid member status values', () => {
      const validStatuses = Object.values(MemberStatus);

      VALID_TRANSITIONS.forEach((transition) => {
        expect(validStatuses).toContain(transition.from);
        expect(validStatuses).toContain(transition.to);
      });
    });

    it('should have no duplicate transitions', () => {
      const transitionKeys = VALID_TRANSITIONS.map(
        (t) => `${t.from} → ${t.to}`
      );
      const uniqueKeys = new Set(transitionKeys);
      expect(uniqueKeys.size).toBe(VALID_TRANSITIONS.length);
    });
  });

  describe('canTransition', () => {
    describe('Active Status Transitions', () => {
      it('should allow Active → Expired (system)', () => {
        expect(canTransition(MemberStatus.Active, MemberStatus.Expired)).toBe(true);
      });

      it('should allow Active → Suspended (policy violation or voluntary hold)', () => {
        expect(canTransition(MemberStatus.Active, MemberStatus.Suspended)).toBe(true);
      });

      it('should not allow Active → Cancelled (must go through Expired)', () => {
        expect(canTransition(MemberStatus.Active, MemberStatus.Cancelled)).toBe(false);
      });

      it('should not allow Active → Active (no-op)', () => {
        expect(canTransition(MemberStatus.Active, MemberStatus.Active)).toBe(false);
      });
    });

    describe('Expired Status Transitions', () => {
      it('should allow Expired → Active (payment)', () => {
        expect(canTransition(MemberStatus.Expired, MemberStatus.Active)).toBe(true);
      });

      it('should allow Expired → Cancelled (45+ days overdue)', () => {
        expect(canTransition(MemberStatus.Expired, MemberStatus.Cancelled)).toBe(true);
      });

      it('should not allow Expired → Suspended (must activate first)', () => {
        expect(canTransition(MemberStatus.Expired, MemberStatus.Suspended)).toBe(false);
      });
    });

    describe('Suspended Status Transitions', () => {
      it('should allow Suspended → Active (reactivated)', () => {
        expect(canTransition(MemberStatus.Suspended, MemberStatus.Active)).toBe(true);
      });

      it('should allow Suspended → Cancelled (permanent ban)', () => {
        expect(canTransition(MemberStatus.Suspended, MemberStatus.Cancelled)).toBe(true);
      });

      it('should allow Suspended → Expired (time passed)', () => {
        expect(canTransition(MemberStatus.Suspended, MemberStatus.Expired)).toBe(true);
      });
    });

    describe('Cancelled Status (Terminal)', () => {
      it('should not allow Cancelled → Active (terminal state)', () => {
        expect(canTransition(MemberStatus.Cancelled, MemberStatus.Active)).toBe(false);
      });

      it('should not allow Cancelled → Expired (terminal state)', () => {
        expect(canTransition(MemberStatus.Cancelled, MemberStatus.Expired)).toBe(false);
      });

      it('should not allow Cancelled → Suspended (terminal state)', () => {
        expect(canTransition(MemberStatus.Cancelled, MemberStatus.Suspended)).toBe(false);
      });

      it('should not allow any transitions out of Cancelled', () => {
        const allStatuses = Object.values(MemberStatus);
        allStatuses.forEach((toStatus) => {
          expect(canTransition(MemberStatus.Cancelled, toStatus)).toBe(false);
        });
      });
    });
  });

  describe('getValidTransitionsFrom', () => {
    it('should return 2 transitions from Active', () => {
      const transitions = getValidTransitionsFrom(MemberStatus.Active);
      expect(transitions).toHaveLength(2);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Expired);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Suspended);
    });

    it('should return 2 transitions from Expired', () => {
      const transitions = getValidTransitionsFrom(MemberStatus.Expired);
      expect(transitions).toHaveLength(2);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Active);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Cancelled);
    });

    it('should return 3 transitions from Suspended', () => {
      const transitions = getValidTransitionsFrom(MemberStatus.Suspended);
      expect(transitions).toHaveLength(3);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Active);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Expired);
      expect(transitions.map((t) => t.to)).toContain(MemberStatus.Cancelled);
    });

    it('should return no transitions from Cancelled (terminal)', () => {
      const transitions = getValidTransitionsFrom(MemberStatus.Cancelled);
      expect(transitions).toHaveLength(0);
    });

    it('should return empty array for invalid status', () => {
      const transitions = getValidTransitionsFrom('invalid' as MemberStatus);
      expect(transitions).toHaveLength(0);
    });
  });

  describe('getValidTransitionsTo', () => {
    it('should return 2 transitions to Active', () => {
      const transitions = getValidTransitionsTo(MemberStatus.Active);
      expect(transitions).toHaveLength(2);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Expired);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Suspended);
    });

    it('should return 2 transitions to Expired', () => {
      const transitions = getValidTransitionsTo(MemberStatus.Expired);
      expect(transitions).toHaveLength(2);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Active);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Suspended);
    });

    it('should return 1 transition to Suspended', () => {
      const transitions = getValidTransitionsTo(MemberStatus.Suspended);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].from).toBe(MemberStatus.Active);
    });

    it('should return 2 transitions to Cancelled', () => {
      const transitions = getValidTransitionsTo(MemberStatus.Cancelled);
      expect(transitions).toHaveLength(2);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Expired);
      expect(transitions.map((t) => t.from)).toContain(MemberStatus.Suspended);
    });

    it('should return empty array for invalid status', () => {
      const transitions = getValidTransitionsTo('invalid' as MemberStatus);
      expect(transitions).toHaveLength(0);
    });
  });

  describe('Allowed By Permissions', () => {
    it('should allow system to expire active members', () => {
      const transition = VALID_TRANSITIONS.find(
        (t) => t.from === MemberStatus.Active && t.to === MemberStatus.Expired
      );
      expect(transition?.allowedBy).toContain('system');
    });

    it('should allow admins to activate expired members', () => {
      const transition = VALID_TRANSITIONS.find(
        (t) => t.from === MemberStatus.Expired && t.to === MemberStatus.Active
      );
      expect(transition?.allowedBy).toContain('admin');
    });

    it('should allow system to cancel overdue members', () => {
      const transition = VALID_TRANSITIONS.find(
        (t) => t.from === MemberStatus.Expired && t.to === MemberStatus.Cancelled
      );
      expect(transition?.allowedBy).toContain('system');
    });

    it('should allow admins to suspend memberships', () => {
      const transition = VALID_TRANSITIONS.find(
        (t) => t.from === MemberStatus.Active && t.to === MemberStatus.Suspended
      );
      expect(transition?.allowedBy).toContain('admin');
    });
  });

  describe('State Machine Integrity', () => {
    it('should have at least one path to Active from all non-terminal states', () => {
      const nonTerminalStatuses = [
        MemberStatus.Expired,
        MemberStatus.Suspended,
      ];

      nonTerminalStatuses.forEach((status) => {
        const canReachActive = canTransition(status, MemberStatus.Active);
        expect(canReachActive).toBe(true);
      });
    });

    it('should have at least one path to Cancelled from all non-terminal statuses', () => {
      const allStatuses = [
        MemberStatus.Active,
        MemberStatus.Expired,
        MemberStatus.Suspended,
      ];

      allStatuses.forEach((status) => {
        // Either direct transition or via Expired
        const canReachDirectly = canTransition(status, MemberStatus.Cancelled);
        const canReachViaExpired =
          canTransition(status, MemberStatus.Expired) &&
          canTransition(MemberStatus.Expired, MemberStatus.Cancelled);

        expect(canReachDirectly || canReachViaExpired).toBe(true);
      });
    });

    it('should have Cancelled as truly terminal (no outgoing transitions)', () => {
      const transitionsOut = getValidTransitionsFrom(MemberStatus.Cancelled);
      expect(transitionsOut).toHaveLength(0);
    });
  });

  describe('Business Logic Scenarios', () => {
    it('Scenario 1: New member registers → Active', () => {
      // Member starts as Active (handled in Member.create)
      const transitions = getValidTransitionsFrom(MemberStatus.Active);
      expect(transitions.length).toBeGreaterThan(0);
    });

    it('Scenario 2: Active member misses payment → Expired', () => {
      expect(canTransition(MemberStatus.Active, MemberStatus.Expired)).toBe(true);
    });

    it('Scenario 3: Expired member pays → Active', () => {
      expect(canTransition(MemberStatus.Expired, MemberStatus.Active)).toBe(true);
    });

    it('Scenario 4: Expired 45+ days → Cancelled', () => {
      expect(canTransition(MemberStatus.Expired, MemberStatus.Cancelled)).toBe(true);
    });

    it('Scenario 5: Cancelled member tries to reactivate → Blocked', () => {
      expect(canTransition(MemberStatus.Cancelled, MemberStatus.Active)).toBe(false);
    });

    it('Scenario 6: Active member violates policy or requests hold → Suspended', () => {
      expect(canTransition(MemberStatus.Active, MemberStatus.Suspended)).toBe(true);
    });

    it('Scenario 7: Suspended member resolves issue → Active', () => {
      expect(canTransition(MemberStatus.Suspended, MemberStatus.Active)).toBe(true);
    });

    it('Scenario 8: Suspended member gets permanent ban → Cancelled', () => {
      expect(canTransition(MemberStatus.Suspended, MemberStatus.Cancelled)).toBe(true);
    });
  });

  describe('Invalid Transition Attempts', () => {
    it('should block Direct Active → Cancelled', () => {
      // Must go through Expired first
      expect(canTransition(MemberStatus.Active, MemberStatus.Cancelled)).toBe(false);
    });

    it('should block Expired → Suspended', () => {
      // Must activate first
      expect(canTransition(MemberStatus.Expired, MemberStatus.Suspended)).toBe(false);
    });

    it('should block all Cancelled → * transitions', () => {
      const allStatuses = Object.values(MemberStatus);
      allStatuses.forEach((status) => {
        expect(canTransition(MemberStatus.Cancelled, status)).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should handle 10,000 transition checks efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        canTransition(MemberStatus.Active, MemberStatus.Expired);
        canTransition(MemberStatus.Expired, MemberStatus.Active);
        canTransition(MemberStatus.Cancelled, MemberStatus.Active);
        getValidTransitionsFrom(MemberStatus.Active);
        getValidTransitionsTo(MemberStatus.Active);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });

  describe('State Machine Visualization', () => {
    it('should document all state transitions for diagram generation', () => {
      // This test generates data that can be used to visualize the state machine
      const stateMap = new Map<MemberStatus, MemberStatus[]>();

      VALID_TRANSITIONS.forEach((transition) => {
        if (!stateMap.has(transition.from)) {
          stateMap.set(transition.from, []);
        }
        stateMap.get(transition.from)!.push(transition.to);
      });

      // Verify state machine structure
      expect(stateMap.size).toBeGreaterThan(0);
      expect(stateMap.has(MemberStatus.Active)).toBe(true);
      expect(stateMap.has(MemberStatus.Expired)).toBe(true);

      // Cancelled should not be in map (no outgoing transitions)
      expect(stateMap.get(MemberStatus.Cancelled) || []).toHaveLength(0);
    });
  });
});
