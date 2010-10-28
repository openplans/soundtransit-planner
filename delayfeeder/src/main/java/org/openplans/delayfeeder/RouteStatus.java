/* Copyright 2010, OpenPlans
 
 This program is free software: you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation, either version 3 of
 the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>. */

package org.openplans.delayfeeder;

import java.io.IOException;
import java.net.URL;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.xml.bind.annotation.XmlRootElement;

import org.apache.log4j.Logger;
import org.hibernate.Query;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.openplans.delayfeeder.feed.RouteFeed;
import org.openplans.delayfeeder.feed.RouteFeedItem;
import org.springframework.beans.factory.annotation.Autowired;

import com.sun.jersey.api.spring.Autowire;
import com.sun.syndication.feed.synd.SyndEntry;
import com.sun.syndication.feed.synd.SyndFeed;
import com.sun.syndication.io.FeedException;
import com.sun.syndication.io.SyndFeedInput;
import com.sun.syndication.io.XmlReader;

@Path("/status")
@XmlRootElement
@Autowire
public class RouteStatus {
	private static final Logger logger = Logger.getLogger(RouteStatus.class);
	
	private static final long FEED_UPDATE_FREQUENCY = 15*60*1000;
	private SessionFactory sessionFactory;


	@Autowired
	public void setSessionFactory(SessionFactory sessionFactory) {
		this.sessionFactory = sessionFactory;
	}
	
	/**
		Main entry point for the route status server
	 */
	@GET
	@Produces( { MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML, MediaType.TEXT_XML })
	public RouteStatusResponse getStatus(
         @QueryParam("agency") String agency,
         @QueryParam("route") String route) {
	 
	 /* get data from cache */
	 RouteFeedItem item = getLatestItem(agency, route);
	 
	 /* serve data */
	 RouteStatusResponse response = new RouteStatusResponse();
	 
	 response.agency = agency;
	 response.route = route;
	 if (item != null) {
		 response.status = item.description;
		 response.date = item.date;
	 }
	 return response;
	}
 
 	@SuppressWarnings("unchecked")
	private RouteFeedItem getLatestItem(String agency, String route) {
 		RouteFeed feed = getFeed(agency, route);
 		if (feed == null) {
 			return null;
 		}
 		GregorianCalendar now = new GregorianCalendar();
 		if (feed.lastFetched == null || now.getTimeInMillis() - feed.lastFetched.getTimeInMillis() > FEED_UPDATE_FREQUENCY) {
 			try {
 				refreshFeed(feed);
 			} catch (Exception e) {
 				e.printStackTrace();
 				logger.warn(e.fillInStackTrace());
 			}
 		}
 		Session session = sessionFactory.getCurrentSession();
 		session.beginTransaction();
 		List list = session.createQuery("from RouteFeedItem order by date desc limit 1").list();
 		if (list.size() == 0 ) {
 			return null;
 		}
 		RouteFeedItem item = (RouteFeedItem) list.get(0);
        return item;
 	}
 	
 	private void refreshFeed(RouteFeed feed) throws IllegalArgumentException, FeedException, IOException {
 		URL url = new URL(feed.url);

        SyndFeedInput input = new SyndFeedInput();
        SyndFeed inFeed = input.build(new XmlReader(url));

 		Session session = sessionFactory.getCurrentSession();
        session.beginTransaction();
       
        Date lastEntry = null;
        for (Object obj : inFeed.getEntries()) {
        	SyndEntry entry = (SyndEntry) obj;
        	Date date = entry.getPublishedDate();
        	if (date.getTime() > feed.lastEntry.getTimeInMillis()) {
        		if (lastEntry == null || date.getTime() > lastEntry.getTime()) {
        			lastEntry = date;
        		}
        		RouteFeedItem item = new RouteFeedItem();
        		item.date = new GregorianCalendar();
        		item.date.setTimeInMillis(date.getTime());
        		item.description = entry.getDescription().getValue();
        		item.feed = feed;
                session.save(item);
        	}
        }

		feed.lastEntry.setTimeInMillis(lastEntry.getTime());
        session.save(feed);
        session.flush();
        session.getTransaction().commit();
	}

	@SuppressWarnings("unchecked")
	private RouteFeed getFeed(String agency, String route) {
 		Session session = sessionFactory.getCurrentSession();
 		session.beginTransaction();
 		Query query = session.createQuery("from RouteFeed where agency = :agency and route = :route");
 		query.setParameter("agency", agency);
 		query.setParameter("route", route);
 		List list = query.list();
 		if (list.size() == 0 ) {
 			return null;
 		}
 		RouteFeed feed = (RouteFeed) list.get(0);
 		session.getTransaction().commit();
 		return feed;
 	}
 
}
