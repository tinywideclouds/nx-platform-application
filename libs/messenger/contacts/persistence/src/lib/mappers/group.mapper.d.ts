import { ContactGroup } from '@nx-platform-application/contacts-types';
import { StorableGroup } from '../records/group.record';
import * as i0 from "@angular/core";
export declare class GroupMapper {
    toDomain(g: StorableGroup): ContactGroup;
    toStorable(g: ContactGroup): StorableGroup;
    static ɵfac: i0.ɵɵFactoryDeclaration<GroupMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<GroupMapper>;
}
