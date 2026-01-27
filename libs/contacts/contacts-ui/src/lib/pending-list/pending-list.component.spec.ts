// libs/contacts/contacts-ui/src/lib/components/pending-list/pending-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PendingListComponent } from './pending-list.component';
import { PendingIdentity } from '@nx-platform-application/contacts-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

const MOCK_STRANGER: PendingIdentity = {
  urn: URN.parse('urn:auth:google:stranger'),
  firstSeenAt: '2023-01-01T00:00:00Z' as any,
};

const MOCK_VOUCHED: PendingIdentity = {
  urn: URN.parse('urn:auth:apple:friend'),
  firstSeenAt: '2023-01-01T00:00:00Z' as any,
  vouchedBy: URN.parse('urn:contacts:user:bob'),
  note: 'Trust me',
};

describe('PendingListComponent', () => {
  let fixture: ComponentFixture<PendingListComponent>;
  let component: PendingListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingListComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('pending', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render an unknown sender correctly', () => {
    fixture.componentRef.setInput('pending', [MOCK_STRANGER]);
    fixture.detectChanges();

    const urnDisplay = fixture.debugElement.query(
      By.css('[data-testid="urn-display"]'),
    );
    const vouchBadge = fixture.debugElement.query(
      By.css('[data-testid="vouch-badge"]'),
    );

    expect(urnDisplay.nativeElement.textContent).toContain('google:stranger');
    expect(vouchBadge).toBeFalsy();
  });

  it('should render a vouched sender correctly', () => {
    fixture.componentRef.setInput('pending', [MOCK_VOUCHED]);
    fixture.detectChanges();

    const vouchBadge = fixture.debugElement.query(
      By.css('[data-testid="vouch-badge"]'),
    );
    expect(vouchBadge).toBeTruthy();
    expect(vouchBadge.nativeElement.textContent).toContain(
      'Vouched by user:bob',
    );
  });

  it('should emit block event', () => {
    fixture.componentRef.setInput('pending', [MOCK_STRANGER]);
    fixture.detectChanges();

    const blockSpy = vi.spyOn(component.block, 'emit');
    const btn = fixture.debugElement.query(
      By.css('[data-testid="block-button"]'),
    );
    btn.nativeElement.click();

    expect(blockSpy).toHaveBeenCalledWith(MOCK_STRANGER);
  });

  it('should emit approve event', () => {
    fixture.componentRef.setInput('pending', [MOCK_STRANGER]);
    fixture.detectChanges();

    const approveSpy = vi.spyOn(component.approve, 'emit');
    const btn = fixture.debugElement.query(
      By.css('[data-testid="approve-button"]'),
    );
    btn.nativeElement.click();

    expect(approveSpy).toHaveBeenCalledWith(MOCK_STRANGER);
  });
});
