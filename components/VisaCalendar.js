import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { STAGE_DEFS } from "../lib/calendarEvents";

export default function VisaCalendar({ events, onEventClick }) {
  return (
    <div className="calendar-wrapper">
      <div className="legend">
        {STAGE_DEFS.map((s) => (
          <div key={s.key} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,listMonth,dayGridWeek",
        }}
        events={events}
        eventClick={(info) => onEventClick && onEventClick(info.event)}
        height="auto"
      />
    </div>
  );
}
