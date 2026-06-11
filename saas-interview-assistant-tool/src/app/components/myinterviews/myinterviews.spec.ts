import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Myinterviews } from './myinterviews';

describe('Myinterviews', () => {
  let component: Myinterviews;
  let fixture: ComponentFixture<Myinterviews>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Myinterviews]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Myinterviews);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
