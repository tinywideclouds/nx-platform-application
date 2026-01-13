import { Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'platform-master-detail-layout',
  standalone: true,
  imports: [],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './master-detail-layout.component.html',
  styleUrl: './master-detail-layout.component.scss',
})
export class MasterDetailLayoutComponent {
  showDetail = input(false);
}
