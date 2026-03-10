export type Role = 'admin' | 'supervisor' | 'driver';

export interface Permissions {
  canCreateDrivers: boolean;
  canDeleteDrivers: boolean;
  canViewWorkingHours: boolean;
  canViewReports: boolean;
  canModifyWorkEntries: boolean;
  canCreateSupervisors: boolean;
  canCreateAdmins: boolean;
  canManageInvites: boolean;
}

export function getPermissions(role: Role | null): Permissions {
  if (!role) {
    return {
      canCreateDrivers: false,
      canDeleteDrivers: false,
      canViewWorkingHours: false,
      canViewReports: false,
      canModifyWorkEntries: false,
      canCreateSupervisors: false,
      canCreateAdmins: false,
      canManageInvites: false,
    };
  }

  if (role === 'admin') {
    return {
      canCreateDrivers: true,
      canDeleteDrivers: true,
      canViewWorkingHours: true,
      canViewReports: true,
      canModifyWorkEntries: true,
      canCreateSupervisors: true,
      canCreateAdmins: true,
      canManageInvites: true,
    };
  }

  if (role === 'supervisor') {
    return {
      canCreateDrivers: true,
      canDeleteDrivers: true,
      canViewWorkingHours: false,
      canViewReports: false,
      canModifyWorkEntries: false,
      canCreateSupervisors: false,
      canCreateAdmins: false,
      canManageInvites: true,
    };
  }

  return {
    canCreateDrivers: false,
    canDeleteDrivers: false,
    canViewWorkingHours: false,
    canViewReports: false,
    canModifyWorkEntries: false,
    canCreateSupervisors: false,
    canCreateAdmins: false,
    canManageInvites: false,
  };
}

export function hasPermission(role: Role | null, permission: keyof Permissions): boolean {
  const permissions = getPermissions(role);
  return permissions[permission];
}
