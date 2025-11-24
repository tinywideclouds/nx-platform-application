import { Component, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-master-detail-layout',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './master-detail-layout.component.html',
  styleUrl: './master-detail-layout.component.scss'
})
export class MasterDetailLayoutComponent {
  showDetail = input(false);
}